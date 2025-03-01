const Buffer = buffer.Buffer;

// Wallet adapter configurations
const WALLET_PROVIDERS = {
    'Phantom': {
        name: 'Phantom',
        icon: 'fa-ghost',
        check: () => {
            const isInstalled = window.solana && window.solana.isPhantom;
            console.log('Checking Phantom wallet:', isInstalled ? 'installed' : 'not installed');
            return isInstalled;
        },
        getProvider: () => window.solana
    },
    'Solflare': {
        name: 'Solflare',
        icon: 'fa-sun',
        check: () => {
            const isInstalled = window.solflare;
            console.log('Checking Solflare wallet:', isInstalled ? 'installed' : 'not installed');
            return isInstalled;
        },
        getProvider: () => {
            try {
                if (!window.solflare) {
                    console.error('Solflare wallet not found in window object');
                    return null;
                }
                return window.solflare;
            } catch (error) {
                console.error("Failed to initialize Solflare:", error);
                return null;
            }
        }
    }
};

// Info modal functionality
document.addEventListener('DOMContentLoaded', () => {
    const infoBtn = document.getElementById('info-btn');
    const infoModal = document.getElementById('info-modal');

    infoBtn.addEventListener('click', () => {
        infoModal.style.display = 'flex';
    });

    // Close modal when clicking outside
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.style.display = 'none';
        }
    });
});


const { Connection, PublicKey, Transaction, SystemProgram } = solanaWeb3;
// Configure Solana connection with proper timeout and commitment
const connection = new Connection("https://go.getblock.io/4136d34f90a6488b84214ae26f0ed5f4", {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
    wsEndpoint: "wss://go.getblock.io/4136d34f90a6488b84214ae26f0ed5f4"
});

let wallet;
let publicKey;

// UI Elements
const loadingOverlay = document.getElementById('loading-overlay');
const connectWalletBtn = document.getElementById('connect-wallet');
const wrapBtn = document.getElementById('wrap-btn');
const amountInput = document.getElementById('wrap-amount');
const amountError = document.getElementById('amount-error');
const transactionStatus = document.getElementById('transaction-status');

function showLoading(message = 'Processing Transaction...') {
    loadingOverlay.querySelector('.loading-text').textContent = message;
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Toast notification functions
function createToast(type, title, message, duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    switch(type) {
        case 'success':
            icon = 'fa-check-circle';
            break;
        case 'error':
            icon = 'fa-exclamation-circle';
            break;
        default:
            icon = 'fa-info-circle';
    }

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="content">
            <div class="title">${title}</div>
            <div class="message">${message}</div>
        </div>
        <button class="close-btn">
            <i class="fas fa-times"></i>
        </button>
    `;

    const container = document.getElementById('toast-container');
    container.appendChild(toast);

    // Add close button functionality
    const closeBtn = toast.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        toast.style.animation = 'slideOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    });

    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOut 0.5s ease forwards';
            setTimeout(() => toast.remove(), 500);
        }
    }, duration);

    return toast;
}

function showError(message) {
    console.error("Error:", message);
    createToast('error', 'Error', message);
}

function showSuccess(message) {
    createToast('success', 'Success', message);
}

function showInfo(message) {
    createToast('info', 'Info', message);
}


// Update the validation function
function validateAmount(amount) {
    const amountError = document.getElementById('amount-error');
    if (!amount || amount <= 0) {
        amountError.textContent = 'Please enter a valid amount';
        return false;
    }
    if (amount < 0.001) {
        amountError.textContent = 'Minimum amount is 0.001 SOL';
        return false;
    }
    amountError.textContent = '';
    return true;
}

async function updateBalances() {
    if (!publicKey) return;

    try {
        showLoading('Fetching balances...');

        // Get SOL balance
        const solBalance = await connection.getBalance(publicKey);
        console.log('SOL Balance (raw):', solBalance);
        console.log('SOL Balance (formatted):', (solBalance / 1e9).toFixed(4));

        document.getElementById('sol-balance').innerHTML = `SOL: ${(solBalance / 1e9).toFixed(4)}`;

        // Get WSOL Token Account
        const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

        try {
            console.log('Fetching token accounts for public key:', publicKey.toString());
            console.log('Using WSOL mint:', WSOL_MINT.toString());
            console.log('Using Token Program ID:', TOKEN_PROGRAM_ID.toString());

            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                mint: WSOL_MINT,
                programId: TOKEN_PROGRAM_ID
            });

            console.log('Token accounts response:', JSON.stringify(tokenAccounts, null, 2));

            let wsolBalance = 0;
            if (tokenAccounts.value.length > 0) {
                console.log('Found', tokenAccounts.value.length, 'WSOL token accounts');
                // Sum up all WSOL token accounts
                wsolBalance = tokenAccounts.value.reduce((total, account) => {
                    const parsedInfo = account.account.data.parsed.info;
                    console.log('Token account info:', JSON.stringify(parsedInfo, null, 2));
                    const amount = parseInt(parsedInfo.tokenAmount.amount);
                    const decimals = parsedInfo.tokenAmount.decimals;
                    console.log('Amount:', amount, 'Decimals:', decimals);
                    return total + (amount / 10 ** decimals);
                }, 0);
            } else {
                console.log('No WSOL token accounts found');
            }

            console.log('Final WSOL balance:', wsolBalance);
            document.getElementById('wsol-balance').innerHTML = `WSOL: ${wsolBalance.toFixed(4)}`;
        } catch (error) {
            console.error("Failed to fetch WSOL balance:", error);
            console.error("Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            document.getElementById('wsol-balance').innerHTML = `
                <i class="fas fa-coins"></i> WSOL Balance: Error
            `;
        }

        hideLoading();
    } catch (error) {
        console.error("Balance update failed:", error);
        console.error("Error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        showError("Failed to update balances");
        hideLoading();
    }
}

// Add these helper functions at the top level
async function getLatestBlockhash(connection) {
    try {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        return { blockhash, lastValidBlockHeight };
    } catch (error) {
        console.error('Error getting blockhash:', error);
        throw error;
    }
}

async function getSignatureStatus(connection, signature) {
    try {
        const { value: status } = await connection.getSignatureStatus(signature);
        console.log('Transaction status:', status);
        return status;
    } catch (error) {
        console.error('Error getting signature status:', error);
        throw error;
    }
}

async function sendAndConfirmTransaction(connection, transaction, wallet, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // Base delay of 1 second

    try {
        showLoading('Getting fresh blockhash...');
        const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(connection);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;

        showLoading('Signing transaction...');
        const signed = await wallet.signTransaction(transaction);

        showLoading('Sending transaction...');
        const signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
            preflightCommitment: 'confirmed'
        });

        console.log(`Transaction sent (attempt ${retryCount + 1}):`, signature);

        showLoading('Confirming transaction...');
        let status = null;
        const startTime = Date.now();
        const TIMEOUT = 60000; // 60 seconds timeout

        while (Date.now() - startTime < TIMEOUT) {
            status = await getSignatureStatus(connection, signature);

            if (status?.err) {
                console.error('Transaction error:', status.err);
                throw new Error(status.err.toString());
            }

            if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
                console.log('Transaction confirmed:', signature);
                return signature;
            }

            // Check for block height exceeded
            if (status?.confirmations === 0 && Date.now() - startTime > 30000) {
                throw new Error('block height exceeded');
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        throw new Error('Transaction confirmation timeout');

    } catch (error) {
        console.error(`Transaction attempt ${retryCount + 1} failed:`, error);

        if (error.message.includes('block height exceeded') && retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY * Math.pow(2, retryCount);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendAndConfirmTransaction(connection, transaction, wallet, retryCount + 1);
        }

        throw error;
    }
}

// Update input event listener
document.getElementById('wrap-amount').addEventListener('input', function() {
    validateAmount(parseFloat(this.value));
});

// Update the wrapSOL function to use the new helper
async function wrapSOL() {
    const amount = parseFloat(amountInput.value);

    if (!validateAmount(amount)) {
        return;
    }

    if (!publicKey) {
        showError("Please connect wallet first!");
        return;
    }

    try {
        showLoading('Preparing transaction...');
        const lamports = amount * 1e9;

        const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
        const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

        showLoading('Finding token account...');
        let tokenAccount;
        let createATA = false;

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            mint: WSOL_MINT,
            programId: TOKEN_PROGRAM_ID
        });

        if (tokenAccounts.value.length > 0) {
            tokenAccount = new PublicKey(tokenAccounts.value[0].pubkey);
            console.log('Using existing token account:', tokenAccount.toString());
        } else {
            console.log('No existing WSOL account found, creating new one...');
            const [associatedTokenAccount] = await PublicKey.findProgramAddress(
                [
                    publicKey.toBuffer(),
                    TOKEN_PROGRAM_ID.toBuffer(),
                    WSOL_MINT.toBuffer(),
                ],
                ASSOCIATED_TOKEN_PROGRAM_ID
            );
            tokenAccount = associatedTokenAccount;
            createATA = true;
        }

        showLoading('Building transaction...');
        const transaction = new Transaction();

        if (createATA) {
            const createATAIx = {
                keys: [
                    { pubkey: publicKey, isSigner: true, isWritable: true },
                    { pubkey: tokenAccount, isSigner: false, isWritable: true },
                    { pubkey: publicKey, isSigner: false, isWritable: false },
                    { pubkey: WSOL_MINT, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: ASSOCIATED_TOKEN_PROGRAM_ID,
                data: Buffer.from([])
            };
            transaction.add(createATAIx);
        }

        transaction.add(
            SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: tokenAccount,
                lamports: lamports
            })
        );

        const syncNativeInstruction = {
            keys: [{ pubkey: tokenAccount, isSigner: false, isWritable: true }],
            programId: TOKEN_PROGRAM_ID,
            data: Buffer.from([17])
        };
        transaction.add(syncNativeInstruction);

        // Send and confirm transaction with retry logic
        const signature = await sendAndConfirmTransaction(connection, transaction, wallet);

        hideLoading();
        showSuccess("SOL wrapped successfully!");
        await new Promise(resolve => setTimeout(resolve, 2000));
        await updateBalances();
        amountInput.value = '';

    } catch (error) {
        hideLoading();
        console.error("Wrapping failed:", error);

        let errorMessage = "Transaction failed. ";
        if (error.message.includes('block height exceeded')) {
            errorMessage += "Please try again with a fresh transaction.";
        } else if (error.message.includes('timeout')) {
            errorMessage += "Please check your balances as the transaction may have completed.";
        } else if (error.message) {
            errorMessage += error.message;
        } else {
            errorMessage += "Please try again.";
        }

        showError(errorMessage);

        try {
            await updateBalances();
        } catch (balanceError) {
            console.error("Failed to update balances after error:", balanceError);
        }
    }
}

// Add disconnect function
async function disconnectWallet() {
    try {
        if (wallet) {
            if (typeof wallet.disconnect === 'function') {
                await wallet.disconnect();
            }
            wallet = null;
            publicKey = null;

            // Reset UI elements
            connectWalletBtn.innerHTML = `
                <i class="fas fa-wallet"></i>
                <span>CONNECT WALLET</span>
            `;
            document.getElementById('sol-balance').innerHTML = 'SOL: 0';
            document.getElementById('wsol-balance').innerHTML = 'WSOL: 0';

            // Reset button state
            connectWalletBtn.removeEventListener('click', disconnectWallet);
            connectWalletBtn.addEventListener('click', createWalletModal);

            showInfo('Wallet disconnected');
        }
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
        showError('Failed to disconnect wallet');
    }
}

// Update connectSpecificWallet function
async function connectSpecificWallet(walletType) {
    const provider = WALLET_PROVIDERS[walletType];

    try {
        console.log(`Starting connection process for ${walletType}`);

        if (!provider.check()) {
            showError(`${provider.name} wallet is not installed. Please install it first.`);
            return;
        }

        showLoading('Connecting Wallet...');

        // Get the appropriate wallet instance
        wallet = provider.getProvider();
        console.log(`Got wallet provider for ${walletType}:`, wallet ? 'success' : 'failed');

        if (!wallet) {
            throw new Error(`Failed to get ${provider.name} wallet provider`);
        }

        // Handle different wallet types
        if (walletType === 'Solflare') {
            try {
                await wallet.connect();
                publicKey = wallet.publicKey;
                console.log('Solflare connection successful, public key:', publicKey?.toString());
            } catch (error) {
                console.error('Solflare specific connection error:', error);
                throw error;
            }
        } else {
            try {
                const connectionResponse = await wallet.connect();
                console.log(`${walletType} connection response:`, connectionResponse);
                publicKey = connectionResponse?.publicKey || wallet.publicKey;
                if (!publicKey) {
                    throw new Error(`Failed to get public key from ${provider.name} wallet`);
                }
            } catch (error) {
                console.error(`${walletType} specific connection error:`, error);
                throw error;
            }
        }

        console.log(`Successfully connected to ${walletType} wallet with public key:`, publicKey.toString());

        // Update button to show connected state
        connectWalletBtn.innerHTML = `
            <i class="fas ${provider.icon}"></i>
            ${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}
        `;

        // Update click handler
        connectWalletBtn.removeEventListener('click', createWalletModal);
        connectWalletBtn.addEventListener('click', disconnectWallet);

        // Hide modal and update UI
        const modal = document.getElementById('wallet-modal');
        if (modal) modal.style.display = 'none';

        await updateBalances();
        showSuccess(`Connected to ${provider.name} wallet successfully!`);

    } catch (error) {
        console.error("Wallet connection failed:", error);
        let errorMessage = "Failed to connect wallet. ";

        if (error.code === 4001) {
            errorMessage += "Connection rejected by user.";
        } else if (error.code === -32002) {
            errorMessage += "Connection request already pending. Check your wallet.";
        } else if (error.message) {
            errorMessage += error.message;
        } else {
            errorMessage += "Please try again.";
        }

        showError(errorMessage);
        resetWalletButton();
    } finally {
        hideLoading();
    }
}

// Helper function to reset wallet button state
function resetWalletButton() {
    connectWalletBtn.innerHTML = `
        <i class="fas fa-wallet"></i>
        <span>CONNECT WALLET</span>
    `;
    connectWalletBtn.removeEventListener('click', disconnectWallet);
    connectWalletBtn.addEventListener('click', createWalletModal);
}

// Update the createWalletModal function
function createWalletModal() {
    // Clear any existing error messages
    const transactionStatus = document.getElementById('transaction-status');
    if (transactionStatus) {
        transactionStatus.innerHTML = '';
    }

    // Log available wallets
    console.log('Available wallets:');
    Object.entries(WALLET_PROVIDERS).forEach(([key, provider]) => {
        console.log(`${key}: ${provider.check() ? 'Available' : 'Not installed'}`);
    });

    const modal = document.getElementById('wallet-modal');
    const modalContent = modal.querySelector('.wallet-list');

    // Clear existing content
    modalContent.innerHTML = Object.entries(WALLET_PROVIDERS).map(([key, provider]) => `
        <button class="wallet-option" data-wallet="${key}">
            <i class="fas ${provider.icon}"></i>
            ${provider.name}
            ${provider.check() ? '' : '<span class="not-installed">(Not Installed)</span>'}
        </button>
    `).join('');

    // Show modal
    modal.style.display = 'flex';

    // Add click handlers
    modalContent.querySelectorAll('.wallet-option').forEach(button => {
        button.addEventListener('click', () => {
            const walletType = button.dataset.wallet;
            console.log(`Attempting to connect to ${walletType} wallet`);
            connectSpecificWallet(walletType);
        });
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Set initial click handler
    connectWalletBtn.removeEventListener('click', disconnectWallet);
    connectWalletBtn.addEventListener('click', createWalletModal);

    wrapBtn.addEventListener('click', wrapSOL);

    // Check for any connected wallets
    Object.entries(WALLET_PROVIDERS).forEach(([key, provider]) => {
        if (provider.check() &&
            ((key === 'Phantom' && window.solana?.isConnected) ||
             (key === 'Solflare' && window.solflare?.isConnected))) {
            connectSpecificWallet(key);
        }
    });
});