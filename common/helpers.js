import { Cart } from '@shopify/app-bridge/actions'
import {
	LOTO_TAG,
	SOURCE_LOTO_TITLE,
	MONTREAL_TZ,
	DISCOUNT_TITLE
} from './constants'

export const getDisplayLotoProductsCount = (products, sourceId, newId) => {
	let result = null
	if (products && Array.isArray(products)) {
		if (products.length === 0) {
			result = 'No source'
		} else if (products.length === 1) {
			if (products[0].id !== sourceId) {
				result = 'No source'
			} else {
				result = 0
			}
		} else {
			result = products.some((product) => product.id === newId)
				? products.length - 2
				: products.length - 1
		}
	}

	return result
}

export const getDisplayErrorMessage = (...errors) => {
	const error = errors.find((error) => error)
	if (!error) return null

	let message = error

	if (typeof message === 'object') {
		try {
			message = JSON.stringify(message)
		} catch (error) {
			message = 'Unexpected error.'
		}
	}

	return message
}

export const getDeletableLotoProducts = (products, sourceId, newId) => {
	return products.filter((item) => {
		const hasLotoTag = item.tags?.includes(LOTO_TAG)
		const hasSourceId = item.id === sourceId
		const hasSourceTitle = item.title === SOURCE_LOTO_TITLE
		const isNewlyCreated = item.id === newId
		const hasLotoTitle = item.title?.toLowerCase()?.includes('loto')
		const hasDiscountTitle = item.title
			?.toLowerCase()
			?.includes(DISCOUNT_TITLE.toLowerCase())
		return (
			hasLotoTag &&
			!hasSourceId &&
			!hasSourceTitle &&
			!isNewlyCreated &&
			(hasLotoTitle || hasDiscountTitle)
		)
	})
}

export const isDateBeforeToday = (
	dateUTCStr,
	nowUTCStr,
	timezone = MONTREAL_TZ
) => {
	const createdAt = new Date(dateUTCStr)
	const now = new Date(nowUTCStr)
	const lastNight = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() - 1,
			23 - timezone,
			59
		)
	)

	return createdAt < lastNight
}

export const getDeleteMutationArgs = (product) => {
	return {
		variables: {
			input: {
				id: product.id
			}
		}
	}
}

export const getDuplicateMutationArgs = (sourceId, title, includeImages) => {
	return {
		variables: {
			newTitle: title,
			productId: sourceId,
			includeImages: includeImages
		}
	}
}

export const getUpdateMutationArgs = (id, price) => {
	return {
		variables: {
			input: {
				id: id,
				variants: [
					{
						price: price,
						taxable: false,
						inventoryItem: {
							tracked: false
						}
					}
				]
			}
		}
	}
}

export const getDiscountData = (cart, discount) => {
	const newCart = cart.total - discount
	const mustPayCash = newCart < 0

	if (mustPayCash) {
		// Since cart is after tax, discount will fully cover it
		return {
			shopifyDiscount: cart.total,
			productTitlePrice: -newCart
		}
	} else {
		// Discount amount has to be after tax
		// products_no_tax - (grand_total - discount) / taxed = real_discount
		const { beforeTax } = cart
		const averageTaxRate = cart.total / beforeTax
		const adjustedDiscount =
			beforeTax - (cart.total - discount) / averageTaxRate
		return {
			shopifyDiscount: adjustedDiscount,
			productTitlePrice: 0
		}
	}
}

const getCartData = (cartUpdatePayload) => {
	const subtotal = cartUpdatePayload?.data?.subtotal
	const taxTotal = cartUpdatePayload?.data?.taxTotal
	const grandTotal = cartUpdatePayload?.data?.grandTotal
	if ([subtotal, taxTotal, grandTotal].some((v) => typeof v !== 'string')) {
		return {
			beforeTax: null,
			taxes: null,
			total: null,
			error: true
		}
	}
	return {
		beforeTax: Number(subtotal),
		taxes: Number(taxTotal),
		total: Number(grandTotal),
		error: null
	}
}

const dispatchSetCartData = (cart, priceSetCb, errorSetCb) => {
	const cartFetchUnsubscribe = cart.subscribe(
		Cart.Action.UPDATE,
		(payload) => {
			const { total, beforeTax, taxes, error } = getCartData(payload)
			if (error) {
				errorSetCb('Unable to get cart grand total')
			} else {
				priceSetCb({ total, beforeTax, taxes })
			}
			cartFetchUnsubscribe()
		}
	)
	cart.dispatch(Cart.Action.FETCH)
}

const hasCartSupport = (features) => {
	const hasFetchCart =
		features.Cart[Cart.Action.FETCH] || features.Cart['FETCH']
	const hasUpdateCart =
		features.Cart[Cart.Action.UPDATE] || features.Cart['UPDATE']
	return hasFetchCart && hasUpdateCart
}

export const attemptGetCartPriceData = (
	cart,
	features,
	priceSetCb,
	errorSetCb,
	unsubscriber
) => {
	if (features && !hasCartSupport(features)) return
	dispatchSetCartData(cart, priceSetCb, errorSetCb)
	unsubscriber && unsubscriber()
}
