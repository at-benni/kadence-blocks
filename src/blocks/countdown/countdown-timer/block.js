/**
 * BLOCK: Kadence Countdown
 *
 * Registering a basic block with Gutenberg.
 */

/**
 * Import Icons
 */
import { countdownInnerIcon } from '@kadence/icons';

/**
 * Internal dependencies
 */
import edit from './edit';
import metadata from './block.json';

/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';
import { useBlockProps } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';

/**
 * Register: a Gutenberg Block.
 *
 * @link https://wordpress.org/gutenberg/handbook/block-api/
 * @param  {string}   name     Block name.
 * @param  {Object}   settings Block settings.
 * @return {?WPBlock}          The block, if it has been successfully
 *                             registered; otherwise `undefined`.
 */
registerBlockType( 'kadence/countdown-timer', {
	...metadata,
	title: __( 'Countdown Timer', 'kadence-blocks' ),
	description: __( 'The countdown timer', 'kadence-blocks' ),
	keywords: [
		__( 'countdown', 'kadence-blocks' ),
		__( 'timer', 'kadence-blocks' ),
		'KB',
	],
	icon: countdownInnerIcon,
	edit,
	save: props => {
		const { attributes: { uniqueID, className } } = props;

		const blockProps = useBlockProps.save( {
			className: `kb-countdown-timer-${ uniqueID } kb-countdown-timer${ ( className ? ' ' + className : '' ) }`
		} );

		return (
			<div {...blockProps}>
				<div className="kb-countdown-item kb-countdown-date-item"><span className="kb-countdown-number">&nbsp;</span><span className="kb-countdown-label">&nbsp;</span></div>
			</div>
		);
	}
} );
