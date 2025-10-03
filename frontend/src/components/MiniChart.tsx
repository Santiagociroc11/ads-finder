import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MiniChartProps {
  data: Array<{
    date: string;
    activeAds: number;
  }>;
  height?: number;
  showTrend?: boolean;
}

const MiniChart: React.FC<MiniChartProps> = ({ 
  data, 
  height = 60, 
  showTrend = true 
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-15 text-gray-500 text-xs">
        Sin datos
      </div>
    );
  }

  // Calcular tendencia
  const getTrend = () => {
    if (data.length < 2) return 'stable';
    const first = data[0].activeAds;
    const last = data[data.length - 1].activeAds;
    const change = ((last - first) / first) * 100;
    
    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  };

  const trend = getTrend();
  const trendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';

  // Formatear datos para el gráfico
  const chartData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('es-ES', { 
      month: 'short', 
      day: 'numeric' 
    })
  }));

  // Calcular colores del gráfico
  const lineColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280';

  return (
    <div className="relative">
      {/* Trend indicator */}
      {showTrend && (
        <div className="flex items-center space-x-1 mb-2">
          {React.createElement(trendIcon, { 
            className: `w-3 h-3 ${trendColor}` 
          })}
          <span className={`text-xs font-medium ${trendColor}`}>
            {trend === 'up' ? 'Subiendo' : trend === 'down' ? 'Bajando' : 'Estable'}
          </span>
        </div>
      )}

      {/* Mini Chart */}
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              hide
              domain={['dataMin - 1', 'dataMax + 1']}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-gray-800 border border-gray-600 rounded-lg p-2 shadow-lg">
                      <p className="text-xs text-gray-300">{label}</p>
                      <p className="text-sm font-semibold text-white">
                        {payload[0].value} anuncios activos
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="activeAds"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ 
                r: 4, 
                fill: lineColor,
                stroke: '#1f2937',
                strokeWidth: 2
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats summary */}
      <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
        <span>
          Min: {Math.min(...data.map(d => d.activeAds))}
        </span>
        <span>
          Max: {Math.max(...data.map(d => d.activeAds))}
        </span>
      </div>
    </div>
  );
};

export default MiniChart;


