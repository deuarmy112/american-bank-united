const https = require('https');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testAdminLogin() {
  try {
    // Test admin login
    const loginOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const loginData = JSON.stringify({
      email: 'admin@americanbankunited.com',
      password: 'Admin@123'
    });

    const loginResponse = await makeRequest(loginOptions, loginData);

    if (loginResponse.status === 200) {
      console.log('✅ Admin login successful!');
      console.log('Token:', loginResponse.data.token);
      console.log('User:', loginResponse.data.user);

      // Test admin dashboard access
      const dashboardOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/admin/dashboard',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginResponse.data.token}`,
          'Content-Type': 'application/json'
        }
      };

      const dashboardResponse = await makeRequest(dashboardOptions);

      if (dashboardResponse.status === 200) {
        console.log('✅ Admin dashboard access successful!');
        console.log('Dashboard stats:', JSON.stringify(dashboardResponse.data.stats, null, 2));
      } else {
        console.log('❌ Admin dashboard access failed:', dashboardResponse.status);
        console.log('Error:', dashboardResponse.data);
      }

    } else {
      console.log('❌ Admin login failed:', loginResponse.status);
      console.log('Error:', loginResponse.data);
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

testAdminLogin();