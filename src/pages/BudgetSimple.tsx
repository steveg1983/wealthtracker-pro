export default function BudgetSimple() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-theme-heading dark:text-white mb-6">Budget Page</h1>
      <p>This is a simple test. If you can see this, routing is working.</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}