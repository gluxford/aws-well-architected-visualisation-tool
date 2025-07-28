// Debug script for Well-Architected API
async function testApiConnection() {
    const API_ENDPOINT = 'https://9jcjq591ni.execute-api.ap-southeast-2.amazonaws.com/prod/proxy';
    
    console.log('Testing API connection...');
    
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                operation: 'list_workloads',
                params: {}
            })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error (${response.status}): ${errorText}`);
            return;
        }
        
        const data = await response.json();
        console.log('API response:', data);
    } catch (error) {
        console.error('Error connecting to API:', error);
    }
}

// Call the test function
testApiConnection();
