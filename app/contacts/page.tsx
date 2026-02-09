'use client';

import { useEffect, useState } from 'react';
import { getContacts } from '@/app/actions/contact';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function ContactsManager() {
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadContacts();
    }, []);

    async function loadContacts() {
        setLoading(true);
        try {
            const data = await getContacts();
            setContacts(data);
        } catch (error) {
            console.error('Error loading contacts:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-bold mb-8">Mensagens Recebidas</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Contactos</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Assunto</TableHead>
                                <TableHead>Mensagem</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Carregando...
                                    </TableCell>
                                </TableRow>
                            ) : contacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Nenhuma mensagem recebida.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                contacts.map((contact) => (
                                    <TableRow key={contact.id}>
                                        <TableCell className="whitespace-nowrap">
                                            {format(new Date(contact.createdAt), "dd 'de' MMM, HH:mm", { locale: pt })}
                                        </TableCell>
                                        <TableCell className="font-medium">{contact.name}</TableCell>
                                        <TableCell>{contact.email}</TableCell>
                                        <TableCell>{contact.subject}</TableCell>
                                        <TableCell className="max-w-md truncate" title={contact.message}>
                                            {contact.message}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
