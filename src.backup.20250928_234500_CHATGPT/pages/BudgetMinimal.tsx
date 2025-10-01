export default function BudgetMinimal() {
  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
        Budget Page - Minimal Test
      </h1>
      <p>If you can see this text, then:</p>
      <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
        <li>✓ React is working</li>
        <li>✓ Routing is working</li>
        <li>✓ Basic rendering is working</li>
      </ul>
      <p style={{ marginTop: '16px', color: 'green' }}>
        No hooks, no context, no external components
      </p>
    </div>
  );
}