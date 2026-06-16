import * as http from 'https';

function fetchUrl(url: string) {
  http.get(url, (res) => {
    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log('Redirecting to:', res.headers.location);
      fetchUrl(res.headers.location);
      return;
    }
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Data sample (first 1000 chars):');
      console.log(data.substring(0, 5000));
    });
  }).on('error', console.error);
}

fetchUrl('https://unpkg.com/@vladmandic/face-api@1.7.15/model/');
