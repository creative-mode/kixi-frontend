'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getNews, deleteNews } from '@/app/actions/news';

import { SearchInput } from '@/components/search-input';

export default function NewsManager() {
    const [news, setNews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');



    const loadNews = useCallback(async (query?: string) => {
        setLoading(true);
        if (typeof query === 'string') {
            setSearchQuery(query);
        }
        try {
            const data = await getNews(query);
            setNews(data);
        } catch (error) {
            toast.error('Erro ao carregar notícias');
        } finally {
            setLoading(false);
        }
    }, []);

    async function handleDelete(id: number) {
        try {
            const result = await deleteNews(id);
            if (result.success) {
                toast.success('Notícia excluída com sucesso');
                loadNews();
            } else {
                toast.error('Erro ao excluir notícia');
            }
        } catch (error) {
            toast.error('Erro inesperado');
        }
    }



    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold">Gerenciar Notícias</h1>
                <Link href="/news/new">
                    <Button className="gap-2 w-full md:w-auto">
                        <Plus size={18} />
                        <span>Nova Notícia</span>
                    </Button>
                </Link>
            </div>

            <div className="mb-6">
                <SearchInput onSearch={loadNews} />
            </div>

            <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Data de Publicação</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    Carregando...
                                </TableCell>
                            </TableRow>
                        ) : news.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    {searchQuery ? 'Nenhuma notícia encontrada para sua busca.' : 'Nenhuma notícia cadastrada.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            news.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.title}</TableCell>
                                    <TableCell>
                                        {new Date(item.publishedAt).toLocaleDateString('pt-PT')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link href={`/news/${item.id}/edit`}>
                                                <Button variant="ghost" size="icon">
                                                    <Pencil size={18} />
                                                </Button>
                                            </Link>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                        <Trash2 size={18} />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta ação não pode ser desfeita. Isso excluirá permanentemente a notícia.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => handleDelete(item.id)}
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        >
                                                            Excluir
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
