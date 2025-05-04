import { crc32 } from './crc32';

export const JettonOp = {
    transfer: 0xf8a7ea5,
    burn: 0x595f07bc,
};

export const SYOp = {
    wrap_and_swap_sy_for_pt: crc32('wrap_and_swap_sy_for_pt'),
    wrap_and_swap_sy_for_yt: crc32('wrap_and_swap_sy_for_yt'),
    swap_pt_for_sy_and_unwrap: crc32('swap_pt_for_sy_and_unwrap'),
    swap_yt_for_sy_and_unwrap: crc32('swap_yt_for_sy_and_unwrap'),
    wrap_and_mint_pt_yt: crc32('wrap_and_mint_pt_yt'),
    redeem_and_unwrap: crc32('redeem_and_unwrap'),
    redeem_after_maturity_and_unwrap: crc32('redeem_after_maturity_and_unwrap'),
    wrap_and_add_liquidity: crc32('wrap_and_add_liquidity'),
    add_liquidity: crc32('add_liquidity'),
    redeem_lp_and_unwrap: crc32('redeem_lp_and_unwrap'),
    claim_interest_and_unwrap: crc32('claim_interest_and_unwrap'),
};

export const PoolOp = {
    add_liquidity: crc32('add_liquidity'),
    redeem_lp: crc32('redeem_lp'),
};

export const EvaaOp = {
    supply_master: 0x1,
    supply_excess: 0x11ae,
    supply_excess_fail: 0x11ae1,
    supply_success: crc32('evaa_supply_success'),
    withdraw_success: crc32('evaa_withdraw_success'),
    withdraw_excess: 0x211a,
    lock: 0xa33,
    is_valid_custom_payload: 0xa34,
    withdraw_master: 0x2,
    change_asset_id: crc32('evaa_change_asset_id'),
    change_evaa_master_address: crc32('evaa_change_master_address'),
    withdraw_no_funds_excess: 0x211fe8,
    evaa_add_item_to_requests: crc32('evaa_add_item_to_requests'),
    evaa_remove_item_from_requests: crc32('evaa_remove_item_from_requests'),
};
