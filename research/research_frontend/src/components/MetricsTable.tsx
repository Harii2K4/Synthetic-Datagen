import React from 'react';

interface DatasetMetric {
  embeddingDimension: number;
  meanPairwiseCosineSimilarity: number;
  p90PairwiseSimilarity: number;
  meanNearestNeighborSimilarity: number;
  topicEntropy: number;
  uniqueTopicCount: number;
  distinct2: number;
}

interface MetricRow {
  datasetId: string;
  datasetLabel: string;
  metrics: DatasetMetric;
}

interface MetricsTableProps {
  data: MetricRow[];
}

const MetricsTable: React.FC<MetricsTableProps> = ({ data }) => {
  const formatNumber = (value: number, decimals: number = 4): string => {
    return value.toFixed(decimals);
  };

  const columns = [
    { key: 'embeddingDimension', label: 'Embedding Dim', format: (v: number) => v.toString() },
    { key: 'meanPairwiseCosineSimilarity', label: 'Mean Pairwise Cosine', format: (v: number) => formatNumber(v) },
    { key: 'p90PairwiseSimilarity', label: 'P90 Pairwise', format: (v: number) => formatNumber(v) },
    { key: 'meanNearestNeighborSimilarity', label: 'Mean Nearest Neighbor', format: (v: number) => formatNumber(v) },
    { key: 'topicEntropy', label: 'Topic Entropy', format: (v: number) => formatNumber(v) },
    { key: 'uniqueTopicCount', label: 'Unique Topics', format: (v: number) => v.toString() },
    { key: 'distinct2', label: 'Distinct-2', format: (v: number) => formatNumber(v) }
  ];

  return (
    <div className="metrics-table-container">
      <h2 className="text-2xl font-bold mb-6 text-center">Dataset Metrics Comparison</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 shadow-lg">
          <thead className="bg-green-600 text-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border-b">
                Dataset
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider border-b"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr
                key={row.datasetId}
                className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-b">
                  {row.datasetLabel}
                </td>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center border-b"
                  >
                    {column.format(row.metrics[column.key as keyof DatasetMetric] as number)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MetricsTable;
