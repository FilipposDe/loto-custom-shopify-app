export const SOURCE_LOTO_TITLE = '_LOTO_SOURCE'
export const LOTO_TAG = '_loto'
export const LOTO_TITLE = '**** LOTO ****'
export const DISCOUNT_TITLE = '**** REFUND >>'
export const DISCOUNT_DESCRIPTION = 'DISCOUNT OF >> >> >>'

export const MODES = {
	LOTO: 'LOTO',
	DISCOUNT: 'DISCOUNT'
}

export const LOTO_SUBMIT_STATE = {
	INIT: {
		message: '',
		stage: 0,
		loading: false
	},
	DUPLICATING: {
		message: 'Duplicating source...',
		stage: 33,
		loading: true
	},
	SETTING_PRICE: {
		message: 'Setting price...',
		stage: 66,
		loading: true
	},
	ADDING_TO_CART: {
		message: 'Adding to cart...',
		stage: 99,
		loading: true
	}
}

export const DISCOUNT_SUBMIT_STATE = {
	INIT: {
		message: '',
		stage: 0,
		loading: false
	},
	DUPLICATING: {
		message: 'Duplicating source...',
		stage: 33,
		loading: true
	},
	SETTING_PRICE: {
		message: 'Setting price...',
		stage: 66,
		loading: true
	},
	ADDING_TO_CART: {
		message: 'Updating cart...',
		stage: 99,
		loading: true
	}
}

export const GENERIC_ERROR_MSG = 'Unexpected error. Please try again later.'

export const INACTIVE_JWT_MSG = 'Inactive JWT'

export const MONTREAL_TZ = -4
