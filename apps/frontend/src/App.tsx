function App() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAFAF8',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          color: '#2C2C2A',
        }}
      >
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#3C3489',
            marginBottom: '8px',
          }}
        >
          SGS
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: '#888780',
          }}
        >
          Plataforma de Gestão para Salões de Beleza
        </p>
        <p
          style={{
            fontSize: '14px',
            color: '#888780',
            marginTop: '4px',
          }}
        >
          Loading...
        </p>
      </div>
    </div>
  );
}

export default App;
