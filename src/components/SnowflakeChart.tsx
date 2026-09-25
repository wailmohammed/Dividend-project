import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { SnowflakeScore } from '../types';

interface SnowflakeChartProps {
  data: SnowflakeScore;
  width?: string;
  height?: number;
}

const SnowflakeChart: React.FC<SnowflakeChartProps> = ({ data, height = 200 }) => {
  // Transform the flat object into an array for Recharts
  const chartData = [
    { subject: 'Value', A: data.value, fullMark: 5 },
    { subject: 'Future', A: data.future, fullMark: 5 },
    { subject: 'Past', A: data.past, fullMark: 5 },
    { subject: 'Health', A: data.health, fullMark: 5 },
    { subject: 'Dividend', A: data.dividend, fullMark: 5 },
  ];

  return (
    <div className="w-full" style={{ height: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          {/* We don't need radius axis for the snowflake look, usually */}
          <Radar
            name="Score"
            dataKey="A"
            stroke="#6366f1"
            strokeWidth={2}
            fill="#6366f1"
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SnowflakeChart;