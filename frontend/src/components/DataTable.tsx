'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { getDataPreview } from '@/lib/api';
import { safeStringify } from '@/lib/utils';

interface DataTableProps {
  sessionId: string;
  configId?: string;
  columns: string[];
}

export default function DataTable({ sessionId, configId, columns }: DataTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRows, setTotalRows] = useState(0);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50,
  });

  const columnHelper = createColumnHelper<any>();
  
  // Create table columns
  const tableColumns = useMemo(() => {
    return columns.map((col) => 
      columnHelper.accessor(col, {
        header: col,
        cell: info => {
          const value = info.getValue();
          return (
            <div className="max-w-xs truncate">
              {safeStringify(value)}
            </div>
          );
        },
      })
    );
  }, [columns, columnHelper]);

  // Fetch data when pagination changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const offset = pagination.pageIndex * pagination.pageSize;
        const limit = pagination.pageSize;
        
        const rows = await getDataPreview(sessionId, offset, limit, configId);
        
        setData(rows.data || []);
        setTotalRows(rows.total || 0);
      } catch (error) {
        console.error('Failed to fetch data preview', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId, pagination, configId]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalRows / pagination.pageSize),
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
  });

  return (
    <div className="overflow-hidden">
      <div className="table-container mb-4">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-r-transparent"></div>
            <p className="mt-2 text-gray-600">Loading data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id}
                        scope="col"
                        className="table-header px-6 py-3"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="table-cell">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4">
        <div className="flex-1 text-sm text-gray-700">
          Showing <span className="font-medium">{table.getState().pagination.pageIndex * pagination.pageSize + 1}</span> to{' '}
          <span className="font-medium">
            {Math.min((table.getState().pagination.pageIndex + 1) * pagination.pageSize, totalRows)}
          </span>{' '}
          of <span className="font-medium">{totalRows}</span> results
        </div>
        <div className="flex items-center space-x-2">
          <button
            className="btn-secondary py-1 px-2 disabled:opacity-50"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <FiChevronLeft />
          </button>
          <span className="px-4 py-1 rounded-md bg-gray-100 text-gray-700 text-sm">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount() || 1}
          </span>
          <button
            className="btn-secondary py-1 px-2 disabled:opacity-50"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <FiChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}