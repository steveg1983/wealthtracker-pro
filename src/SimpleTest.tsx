export default function SimpleTest() {
  return (
    <div style={{ padding: '20px', backgroundColor: 'lightblue', minHeight: '100vh' }}>
      <h1>Simple Test Component</h1>
      <p>If you can see this blue page, React is rendering correctly.</p>
      <p>Current URL: {window.location.href}</p>
      <p>Pathname: {window.location.pathname}</p>
    </div>
  );
}