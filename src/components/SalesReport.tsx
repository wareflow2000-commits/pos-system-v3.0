import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SalesReport: React.FC = () => {
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await apiService.getSalesReport({});
        setReportData(data);
      } catch (error) {
        console.error('Failed to fetch sales report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-4 bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-bold mb-4">Sales Report</h2>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={reportData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="totalsales" fill="#8884d8" name="Total Sales" />
          <Bar dataKey="ordercount" fill="#82ca9d" name="Order Count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SalesReport;
