import React from 'react'
import { useMutation } from 'react-apollo'

import {
	DELETE_MUTATION,
	DUPLICATE_MUTATION,
	UPDATE_MUTATION
} from '../common/graphQLQueries'

export const useMutations = () => {
	const [duplicate, { error: duplicateError }] =
		useMutation(DUPLICATE_MUTATION)

	const [update, { error: updateError }] = useMutation(UPDATE_MUTATION)

	const [delete_, { error: deleteError, loading: deleteLoading }] =
		useMutation(DELETE_MUTATION)

	return {
		duplicate,
		update,
		delete_,
		duplicateError,
		updateError,
		deleteError,
		deleteLoading
	}
}

export const useInstructionsToggle = () => {
	const [isOpen, setIsOpen] = React.useState(false)

	const toggle = React.useCallback(() => setIsOpen((open) => !open), [])

	return {
		isInstructionsOpen: isOpen,
		toggleInstructions: toggle
	}
}

export const useSettingsToggle = () => {
	const [isOpen, setIsOpen] = React.useState(false)

	const toggle = React.useCallback(() => setIsOpen((open) => !open), [])

	return {
		isSettingsOpen: isOpen,
		toggleSettings: toggle
	}
}
