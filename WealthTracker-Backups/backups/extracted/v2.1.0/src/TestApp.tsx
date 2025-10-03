export default function TestApp() {
  console.log('TestApp component rendering');
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'red', 
      color: 'white',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999
    }}>
      <h1>Test App - React is Working!</h1>
      <p>If you see this, React is loading correctly.</p>
      <p>Background should be red.</p>
    </div>
  );
}