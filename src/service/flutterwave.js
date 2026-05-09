const axios = require('axios');
const { flutterwaveSecretKey } = require('../config/env');
const { AppError } = require('../utils/http');

const client = axios.create({
  baseURL: 'https://api.flutterwave.com/v3',
  timeout: 20000,
});

function ensureFlutterwaveReady() {
  if (!flutterwaveSecretKey) {
    throw new AppError('Flutterwave is not configured on the server.', 500);
  }
}

async function initializeFlutterwavePayment(payload) {
  ensureFlutterwaveReady();
  const response = await client.post('/payments', payload, {
    headers: {
      Authorization: `Bearer ${flutterwaveSecretKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.data?.status || !response.data?.data?.link) {
    throw new AppError('Flutterwave checkout could not be initialized.', 502, response.data || null);
  }

  return response.data.data;
}

async function verifyFlutterwaveTransaction(transactionId) {
  ensureFlutterwaveReady();
  const response = await client.get(`/transactions/${transactionId}/verify`, {
    headers: {
      Authorization: `Bearer ${flutterwaveSecretKey}`,
    },
  });

  if (!response.data?.status || !response.data?.data) {
    throw new AppError('Flutterwave verification failed.', 502, response.data || null);
  }

  return response.data.data;
}

module.exports = { initializeFlutterwavePayment, verifyFlutterwaveTransaction };
