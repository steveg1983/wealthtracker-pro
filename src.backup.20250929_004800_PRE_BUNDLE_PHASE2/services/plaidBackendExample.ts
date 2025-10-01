// Example backend API implementation for Plaid (Node.js/Express)
// This file is for reference only - should be implemented in your backend

/*
// Backend environment variables needed:
// PLAID_CLIENT_ID
// PLAID_SECRET
// PLAID_ENV (sandbox/development/production)
// DATABASE_URL

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import express from 'express';
import { authenticateUser } from './auth';

const plaidClient = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
}));

const router = express.Router();

// Create link token endpoint
router.post('/create-link-token', authenticateUser, async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.user.id },
      client_name: 'WealthTracker',
      products: ['accounts', 'transactions'],
      country_codes: ['US'],
      language: 'en',
      redirect_uri: process.env.PLAID_REDIRECT_URI,
    });
    
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// Exchange public token endpoint
router.post('/exchange-public-token', authenticateUser, async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });
    
    // Store access token securely in database
    await db.plaidConnections.create({
      userId: req.user.id,
      accessToken: response.data.access_token, // Encrypted in DB
      itemId: response.data.item_id,
    });
    
    // Return only safe data to client
    res.json({
      item_id: response.data.item_id,
      success: true,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// Get accounts endpoint
router.get('/accounts/:itemId', authenticateUser, async (req, res) => {
  try {
    // Retrieve access token from database
    const connection = await db.plaidConnections.findOne({
      userId: req.user.id,
      itemId: req.params.itemId,
    });
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    const response = await plaidClient.accountsGet({
      access_token: connection.accessToken,
    });
    
    // Return account data without sensitive info
    res.json({
      accounts: response.data.accounts.map(account => ({
        account_id: account.account_id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        balances: account.balances,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Get transactions endpoint
router.post('/transactions', authenticateUser, async (req, res) => {
  try {
    const { itemId, startDate, endDate } = req.body;
    
    const connection = await db.plaidConnections.findOne({
      userId: req.user.id,
      itemId,
    });
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    const response = await plaidClient.transactionsGet({
      access_token: connection.accessToken,
      start_date: startDate,
      end_date: endDate,
    });
    
    res.json({
      transactions: response.data.transactions,
      total_transactions: response.data.total_transactions,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Remove connection endpoint
router.delete('/connection/:itemId', authenticateUser, async (req, res) => {
  try {
    const connection = await db.plaidConnections.findOne({
      userId: req.user.id,
      itemId: req.params.itemId,
    });
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Remove item from Plaid
    await plaidClient.itemRemove({
      access_token: connection.accessToken,
    });
    
    // Remove from database
    await db.plaidConnections.delete({
      userId: req.user.id,
      itemId: req.params.itemId,
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove connection' });
  }
});

export default router;
*/

// Security Best Practices:
// 1. Never expose Plaid access tokens to the client
// 2. Always authenticate users before Plaid operations
// 3. Encrypt access tokens in the database
// 4. Use HTTPS for all API endpoints
// 5. Implement rate limiting
// 6. Log all Plaid operations for audit trail
// 7. Handle Plaid webhooks for real-time updates
// 8. Implement proper error handling and retry logic

export const plaidSecurityNote = `
This is a reference implementation for secure Plaid integration.
All Plaid operations should be performed server-side with proper authentication.
Never store or transmit access tokens to the client application.
`;