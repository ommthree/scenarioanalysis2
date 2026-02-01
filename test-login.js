const testLogin = async () => {
  const response = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'OwenAdmin',
      password: '16SaPe66ebf**!'
    })
  });

  const text = await response.text();
  console.log('Status:', response.status);
  console.log('Response:', text);
};

testLogin();
