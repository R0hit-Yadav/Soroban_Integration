#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
    let contract_address = env.register_stellar_asset_contract(admin.clone());
    (
        token::Client::new(env, &contract_address),
        token::StellarAssetClient::new(env, &contract_address),
    )
}

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, DepositContract);
    let client = DepositContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let (token_client, _) = create_token_contract(&env, &admin);

    client.initialize(&token_client.address);
    
    assert_eq!(client.get_token(), token_client.address);
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_twice() {
    let env = Env::default();
    let contract_id = env.register_contract(None, DepositContract);
    let client = DepositContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let (token_client, _) = create_token_contract(&env, &admin);

    client.initialize(&token_client.address);
    client.initialize(&token_client.address);
}

#[test]
fn test_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, DepositContract);
    let client = DepositContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token_client, token_admin) = create_token_contract(&env, &admin);

    // Initialize contract
    client.initialize(&token_client.address);

    // Mint tokens to user
    token_admin.mint(&user, &1000);

    // Deposit tokens
    client.deposit(&user, &500);

    // Check balance
    assert_eq!(client.get_balance(&user), 500);
    assert_eq!(token_client.balance(&contract_id), 500);
    assert_eq!(token_client.balance(&user), 500);
}

#[test]
fn test_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, DepositContract);
    let client = DepositContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token_client, token_admin) = create_token_contract(&env, &admin);

    client.initialize(&token_client.address);
    token_admin.mint(&user, &1000);
    
    // Deposit and withdraw
    client.deposit(&user, &500);
    client.withdraw(&user, &200);

    assert_eq!(client.get_balance(&user), 300);
    assert_eq!(token_client.balance(&user), 700);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_withdraw_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, DepositContract);
    let client = DepositContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token_client, token_admin) = create_token_contract(&env, &admin);

    client.initialize(&token_client.address);
    token_admin.mint(&user, &1000);
    client.deposit(&user, &500);
    
    client.withdraw(&user, &600);
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_deposit_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, DepositContract);
    let client = DepositContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token_client, _) = create_token_contract(&env, &admin);

    client.initialize(&token_client.address);
    client.deposit(&user, &0);
}