'use client';

import { useEffect, useState } from 'react';
import { getDashboardMetrics } from '@/app/actions/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, MessageSquare, ThumbsUp, ThumbsDown, TrendingUp, TrendingDown, FileText, Layers, Briefcase, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardMetrics {
    totals: {
        posts: number;
        services: number;
        projects: number;
        comments: number;
        views: number;
        likes: number;
        dislikes: number;
    };
    today: {
        views: number;
        comments: number;
        likes: number;
    };
    yesterday: {
        views: number;
        comments: number;
        likes: number;
    };
    topPosts: any[];
    pendingComments: number;
    chartData: Array<{
        date: string;
        views: number;
        comments: number;
        likes: number;
    }>;
}

export default function ManagerDashboard() {
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadMetrics() {
            const result = await getDashboardMetrics();
            if (result.success && result.data) {
                setMetrics(result.data);
            }
            setLoading(false);
        }
        loadMetrics();
    }, []);

    const calculateChange = (today: number, yesterday: number) => {
        if (yesterday === 0) return today > 0 ? 100 : 0;
        return ((today - yesterday) / yesterday) * 100;
    };

    if (loading) {
        return (
            <div className="p-8 max-w-7xl mx-auto space-y-8">
                <Skeleton className="h-12 w-64" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
            </div>
        );
    }

    if (!metrics) {
        return <div className="p-8">Failed to load metrics</div>;
    }

    const viewsChange = calculateChange(metrics.today.views, metrics.yesterday.views);
    const commentsChange = calculateChange(metrics.today.comments, metrics.yesterday.comments);
    const likesChange = calculateChange(metrics.today.likes, metrics.yesterday.likes);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-4xl font-bold mb-2 tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back! Here's what's happening with your content.</p>
            </div>

            {/* Pending Comments Alert */}
            {metrics.pendingComments > 0 && (
                <Card className="border-orange-200 bg-orange-50/50">
                    <CardContent className="flex items-center gap-3 p-4">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        <p className="text-sm font-medium text-orange-900">
                            You have {metrics.pendingComments} comment{metrics.pendingComments !== 1 ? 's' : ''} waiting for approval
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Today's Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Views Today</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.today.views.toLocaleString()}</div>
                        <p className={`text-xs flex items-center gap-1 mt-1 ${viewsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {viewsChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {Math.abs(viewsChange).toFixed(1)}% from yesterday
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Comments Today</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.today.comments.toLocaleString()}</div>
                        <p className={`text-xs flex items-center gap-1 mt-1 ${commentsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {commentsChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {Math.abs(commentsChange).toFixed(1)}% from yesterday
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Likes Today</CardTitle>
                        <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.today.likes.toLocaleString()}</div>
                        <p className={`text-xs flex items-center gap-1 mt-1 ${likesChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {likesChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {Math.abs(likesChange).toFixed(1)}% from yesterday
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totals.posts}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Services</CardTitle>
                        <Layers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totals.services}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Projects</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totals.projects}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totals.views.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            {/* 7-Day Trend Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>7-Day Engagement Trend</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex items-end justify-between gap-2">
                        {metrics.chartData.map((day, index) => {
                            const maxValue = Math.max(...metrics.chartData.map(d => Math.max(d.views, d.comments * 10, d.likes * 5)));
                            const viewsHeight = (day.views / maxValue) * 100;
                            const commentsHeight = (day.comments * 10 / maxValue) * 100;
                            const likesHeight = (day.likes * 5 / maxValue) * 100;

                            return (
                                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                                    <div className="w-full flex items-end justify-center gap-1 h-48">
                                        <div
                                            className="w-1/3 bg-blue-500 rounded-t transition-all hover:opacity-80"
                                            style={{ height: `${viewsHeight}%` }}
                                            title={`Views: ${day.views}`}
                                        />
                                        <div
                                            className="w-1/3 bg-green-500 rounded-t transition-all hover:opacity-80"
                                            style={{ height: `${commentsHeight}%` }}
                                            title={`Comments: ${day.comments}`}
                                        />
                                        <div
                                            className="w-1/3 bg-purple-500 rounded-t transition-all hover:opacity-80"
                                            style={{ height: `${likesHeight}%` }}
                                            title={`Likes: ${day.likes}`}
                                        />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                        {new Date(day.date).toLocaleDateString('pt', { weekday: 'short' })}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-center gap-6 mt-4 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded" />
                            <span>Views</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded" />
                            <span>Comments</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-purple-500 rounded" />
                            <span>Likes</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Top Posts */}
            <Card>
                <CardHeader>
                    <CardTitle>Top Performing Posts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {metrics.topPosts.map((post, index) => (
                            <div key={post.id} className="flex items-center justify-between p-4 rounded-lg border">
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                                    <div>
                                        <h3 className="font-semibold">{post.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {new Date(post.publishedAt).toLocaleDateString('pt')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 text-sm">
                                    <div className="flex items-center gap-1">
                                        <Eye size={14} className="text-muted-foreground" />
                                        <span>{post._count.views}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <MessageSquare size={14} className="text-muted-foreground" />
                                        <span>{post._count.comments}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <ThumbsUp size={14} className="text-muted-foreground" />
                                        <span>{post._count.likes}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {metrics.topPosts.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No posts yet. Create your first post to see analytics!</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
