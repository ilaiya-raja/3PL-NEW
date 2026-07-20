'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { apiClient, unwrapList } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import {
  QueryError,
  SessionMissing,
} from '@/components/shared/query-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Document {
  id: string;
  type: string;
  filename: string;
  url?: string | null;
  downloadUrl?: string | null;
  createdAt: string;
  relatedTo?: string;
  relatedEntity?: string;
  relatedId?: string;
}

export default function DocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const hasToken = !!session?.accessToken;

  const { data: documents, isPending, isError, error, refetch } = useQuery<
    Document[]
  >({
    queryKey: ['documents', typeFilter],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error('No token');
      apiClient.setToken(session.accessToken);
      const params = typeFilter !== 'all' ? `?type=${typeFilter}&limit=100` : '?limit=100';
      const res = await apiClient.get(`/api/v1/portal/documents${params}`);
      return unwrapList<Document>(res).map((doc) => ({
        ...doc,
        url: doc.downloadUrl || doc.url || null,
        relatedTo: doc.relatedTo || doc.relatedId || doc.relatedEntity,
      }));
    },
    enabled: hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  const filteredDocuments = documents?.filter((doc) =>
    searchQuery
      ? doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.relatedTo?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const handleDownload = async (doc: Document) => {
    try {
      if (!session?.accessToken) return;
      apiClient.setToken(session.accessToken);
      const result = await apiClient.get<{ downloadUrl: string; url: string }>(
        `/api/v1/portal/documents/${encodeURIComponent(doc.id)}/download`
      );
      const href = result.downloadUrl || result.url || doc.url;
      if (!href) return;

      if (href.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = href;
        a.download = doc.filename;
        a.click();
        return;
      }

      window.open(href, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      if (doc.url) window.open(doc.url, '_blank');
    }
  };

  const columns = [
    {
      header: 'Type',
      accessor: (row: Document) => (
        <Badge variant="outline">{row.type}</Badge>
      ),
    },
    {
      header: 'Filename',
      accessor: (row: Document) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>{row.filename}</span>
        </div>
      ),
    },
    {
      header: 'Related To',
      accessor: (row: Document) => row.relatedTo || '-',
    },
    {
      header: 'Created',
      accessor: (row: Document) => formatDate(row.createdAt),
    },
    {
      header: 'Actions',
      accessor: (row: Document) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            void handleDownload(row);
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Documents"
        description="Packing lists, proof of delivery, ASN files, and labels"
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by filename or reference…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 bg-background/60"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-10 w-full bg-background/60 sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="LABEL">Labels</SelectItem>
            <SelectItem value="POD">Proof of Delivery</SelectItem>
            <SelectItem value="ASN">ASN Documents</SelectItem>
            <SelectItem value="INVOICE">Invoices</SelectItem>
            <SelectItem value="PACKING_LIST">Packing Lists</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {status === 'loading' || (hasToken && isPending) ? (
        <DataTable
          data={[]}
          columns={columns}
          isLoading
          emptyMessage="No documents found"
        />
      ) : status === 'unauthenticated' || !hasToken ? (
        <SessionMissing onRetry={() => router.push('/login')} />
      ) : isError ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <DataTable
          data={filteredDocuments || []}
          columns={columns}
          emptyMessage="No documents found"
        />
      )}
    </>
  );
}
