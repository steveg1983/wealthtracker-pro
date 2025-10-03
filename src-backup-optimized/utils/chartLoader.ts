/**
 * Chart Loading Utilities
 */

export const chartLoader = {
  loadPieChart: async () => {
    const module = await import('recharts');
    return module.PieChart;
  },

  loadBarChart: async () => {
    const module = await import('recharts');
    return module.BarChart;
  },

  loadLineChart: async () => {
    const module = await import('recharts');
    return module.LineChart;
  },

  loadAreaChart: async () => {
    const module = await import('recharts');
    return module.AreaChart;
  }
};

export default chartLoader;
