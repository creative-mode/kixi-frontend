    'use client';

import { useState, useEffect } from 'react';
import { getComments, approveComment, deleteComment } from '@/app/actions/posts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Trash2, Clock } from 'lucide-react';

export default function CommentsManager() {
    const [pendingComments, setPendingComments] = useState<any[]>([]);
    const [approvedComments, setApprovedComments] = useState<any[]>([]);

    async function loadComments() {
        const pending = await getComments(false);
        const approved = await getComments(true);
        setPendingComments(pending);
        setApprovedComments(approved);
    }

    useEffect(() => {
        loadComments();
    }, []);

    async function handleApprove(id: number) {
        const result = await approveComment(id);
        if (result.success) {
            toast.success('Comment approved');
            loadComments();
        } else {
            toast.error(result.error);
        }
    }

    async function handleDelete(id: number) {
        if (confirm('Are you sure you want to delete this comment?')) {
            const result = await deleteComment(id);
            if (result.success) {
                toast.success('Comment deleted');
                loadComments();
            } else {
                toast.error(result.error);
            }
        }
    }

    const CommentCard = ({ comment, showApprove }: { comment: any; showApprove: boolean }) => (
        <Card>
            <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold">{comment.author}</span>
                            <span className="text-xs text-muted-foreground">{comment.email}</span>
                        </div>
                        <p className="text-sm mb-3">{comment.content}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Post: {comment.post.title}</span>
                            <span>{new Date(comment.createdAt).toLocaleDateString('pt')}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {showApprove && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleApprove(comment.id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                                <Check size={18} />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(comment.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 size={18} />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Manage Comments</h1>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="pending" className="flex items-center gap-2">
                        <Clock size={16} />
                        Pending ({pendingComments.length})
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="flex items-center gap-2">
                        <Check size={16} />
                        Approved ({approvedComments.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6 space-y-4">
                    {pendingComments.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center text-muted-foreground">
                                No pending comments. Great job!
                            </CardContent>
                        </Card>
                    ) : (
                        pendingComments.map((comment) => (
                            <CommentCard key={comment.id} comment={comment} showApprove={true} />
                        ))
                    )}
                </TabsContent>

                <TabsContent value="approved" className="mt-6 space-y-4">
                    {approvedComments.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center text-muted-foreground">
                                No approved comments yet.
                            </CardContent>
                        </Card>
                    ) : (
                        approvedComments.map((comment) => (
                            <CommentCard key={comment.id} comment={comment} showApprove={false} />
                        ))
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
