"use client";

import { useState, useEffect } from "react";
import { getPartners, deletePartner } from "@/app/actions/partners";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { SearchInput } from "@/components/search-input";

export default function PartnersManager() {
  const [partners, setPartners] = useState<any[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getPartners().then(setPartners);
  }, [query]);

  async function handleDelete(id: number) {
    if (!confirm("Deseja realmente deletar este parceiro?")) return;
    const res = await deletePartner(id);
    if (res.success) {
      setPartners((prev) => prev.filter((p) => p.id !== id));
      toast.success("Parceiro deletado com sucesso!");
    } else {
      toast.error(res.error || "Erro ao deletar parceiro");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Gerenciar Parceiros</h1>
        <Link href="/partners/new">
          <Button className="gap-2">
            <Plus size={18} />
            <span className="hidden md:inline">Novo Parceiro</span>
          </Button>
        </Link>
      </div>
      <SearchInput onSearch={setQuery} placeholder="Buscar parceiro..." />
      <div className="grid gap-4 mt-4">
        {partners.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex justify-between items-center p-6">
              <div className="flex items-center gap-4">
                <img src={p.logoUrl} alt={p.name} className="w-16 h-16 object-contain rounded bg-white border" />
                <div>
                  <div className="font-semibold text-lg">{p.name}</div>
                  <a href={p.siteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm flex items-center gap-1">
                    <ExternalLink size={14} />
                    {p.siteUrl}
                  </a>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/partners/${p.id}/edit`}><Button variant="outline"><Edit size={16} /></Button></Link>
                <Button variant="destructive" onClick={() => handleDelete(p.id)}><Trash2 size={16} /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {partners.length === 0 && <div className="text-center text-muted-foreground py-12">Nenhum parceiro encontrado.</div>}
      </div>
    </div>
  );
}
