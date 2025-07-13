export default function SimpleTest() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Simple Test - App is Loading</h1>
      <p>If you see this, React is working correctly.</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}