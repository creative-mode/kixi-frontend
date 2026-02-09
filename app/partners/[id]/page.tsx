"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPartnerById } from "@/app/actions/partners";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Edit, ExternalLink } from "lucide-react";

export default function PartnerDetailsPage() {
  const params = useParams();
  const id = Number(params.id);
  const [partner, setPartner] = useState<any | null>(null);

  useEffect(() => {
    getPartnerById(id).then(setPartner);
  }, [id]);

  if (!partner) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{partner.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            <img src={partner.logoUrl} alt={partner.name} className="w-32 h-32 object-contain rounded bg-white border" />
            <a href={partner.siteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm flex items-center gap-1">
              <ExternalLink size={16} />
              {partner.siteUrl}
            </a>
            <Link href={`/partners/${partner.id}/edit`}>
              <Button variant="outline" className="mt-4"><Edit size={16} /> Editar</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
