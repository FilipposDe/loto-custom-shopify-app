import { gql } from 'apollo-boost'

export const DUPLICATE_MUTATION = gql`
	mutation productDuplicate(
		$newTitle: String!
		$productId: ID!
		$includeImages: Boolean
	) {
		productDuplicate(
			newTitle: $newTitle
			productId: $productId
			includeImages: $includeImages
		) {
			newProduct {
				id
				variants(first: 1) {
					edges {
						node {
							id
						}
					}
				}
			}
		}
	}
`

export const UPDATE_MUTATION = gql`
	mutation productUpdate($input: ProductInput!) {
		productUpdate(input: $input) {
			product {
				id
				variants(first: 1) {
					edges {
						node {
							id
						}
					}
				}
			}
		}
	}
`

export const LOTO_PRODUCTS_QUERY = gql`
	query {
		products(first: 30, query: "tag:_loto") {
			edges {
				node {
					id
					title
					tags
					createdAt
				}
			}
		}
	}
`

export const DELETE_MUTATION = gql`
	mutation productDelete($input: ProductDeleteInput!) {
		productDelete(input: $input) {
			deletedProductId
		}
	}
`
