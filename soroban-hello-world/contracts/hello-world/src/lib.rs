#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, token};

#[cfg(test)]
mod test;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Balance(Address),
    Token,
}

#[contract]
pub struct DepositContract;

#[contractimpl]
impl DepositContract {
    /// Initialize the contract with a token address
    pub fn initialize(env: Env, token: Address) {
        if env.storage().instance().has(&DataKey::Token) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// Deposit tokens into the contract
    pub fn deposit(env: Env, from: Address, amount: i128) {
        // Verify the caller
        from.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Get the token address
        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic!("Contract not initialized"));

        // Get current balance
        let balance_key = DataKey::Balance(from.clone());
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0);

        // Transfer tokens from user to contract
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        // Update balance
        let new_balance = current_balance + amount;
        env.storage()
            .persistent()
            .set(&balance_key, &new_balance);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "deposit"), from.clone()),
            (amount, new_balance),
        );
    }

    /// Get balance of a user
    pub fn get_balance(env: Env, user: Address) -> i128 {
        let balance_key = DataKey::Balance(user);
        env.storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0)
    }

    /// Withdraw tokens from the contract
    pub fn withdraw(env: Env, to: Address, amount: i128) {
        to.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Get current balance
        let balance_key = DataKey::Balance(to.clone());
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0);

        if current_balance < amount {
            panic!("Insufficient balance");
        }

        // Get token address
        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic!("Contract not initialized"));

        // Transfer tokens from contract to user
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &to, &amount);

        // Update balance
        let new_balance = current_balance - amount;
        env.storage()
            .persistent()
            .set(&balance_key, &new_balance);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "withdraw"), to.clone()),
            (amount, new_balance),
        );
    }

    /// Get the token address
    pub fn get_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .unwrap_or_else(|| panic!("Contract not initialized"))
    }
}
