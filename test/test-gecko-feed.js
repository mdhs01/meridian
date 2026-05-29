/**
 * Test GeckoTerminal API Connection & OHLCV Data Feed
 * Validates primary data source for technical analysis
 */

import { fetchCandles } from '../tools/technicals.js';

// Test with a known Solana token (USDC/SOL pair)
const TEST_TOKENS = [
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'So11111111111111111111111111111111111111112',  // SOL
];

async function testGeckoFeed() {
    console.log('🔴 Testing GeckoTerminal API Connection...\n');
    
    for (const token of TEST_TOKENS) {
        console.log(`Testing token: ${token.slice(0, 8)}...${token.slice(-8)}`);
        
        try {
            const startTime = Date.now();
            const candles = await fetchCandles(token);
            const endTime = Date.now();
            
            if (candles && candles.length > 0) {
                console.log(`✅ SUCCESS - Received ${candles.length} candles in ${endTime - startTime}ms`);
                
                // Show last 3 candles
                const lastCandles = candles.slice(-3);
                console.log('\nLast 3 candles:');
                lastCandles.forEach((c, i) => {
                    console.log(`  ${i + 1}. Time: ${new Date(c.time).toISOString().slice(11, 19)}`);
                    console.log(`     O: ${c.open.toFixed(6)} H: ${c.high.toFixed(6)} L: ${c.low.toFixed(6)} C: ${c.close.toFixed(6)}`);
                    console.log(`     Vol: ${c.volume.toFixed(2)}`);
                });
                
                // Validate candle structure
                const validStructure = candles.every(c => 
                    c.time && 
                    typeof c.open === 'number' && 
                    typeof c.high === 'number' && 
                    typeof c.low === 'number' && 
                    typeof c.close === 'number' &&
                    typeof c.volume === 'number'
                );
                
                if (validStructure) {
                    console.log('✅ Candle structure is valid\n');
                } else {
                    console.log('❌ WARNING: Some candles have invalid structure\n');
                }
            } else {
                console.log('⚠️  WARNING: No candle data received (empty array)\n');
            }
        } catch (error) {
            console.log(`❌ ERROR: ${error.message}\n`);
        }
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('='.repeat(60));
    console.log('Test completed! Check output above for status.');
    console.log('='.repeat(60));
}

// Run the test
testGeckoFeed().catch(console.error);
