/**
 * External dependencies
 */
import { View, TouchableWithoutFeedback } from 'react-native';

/**
 * WordPress dependencies
 */
import { Component } from '@wordpress/element';
import {
	requestMediaImport,
	mediaUploadSync,
	requestImageFailedRetryDialog,
	requestImageUploadCancelDialog,
	requestImageFullscreenPreview,
	setFeaturedImage,
} from '@wordpress/react-native-bridge';
import {
	Icon,
	ToolbarButton,
	ToolbarGroup,
	Image,
	WIDE_ALIGNMENTS,
	LinkSettingsNavigation,
	BottomSheet,
	BottomSheetTextControl,
	BottomSheetSelectControl,
	FooterMessageControl,
	FooterMessageLink,
	Badge,
} from '@wordpress/components';
import {
	BlockCaption,
	MediaPlaceholder,
	MediaUpload,
	MediaUploadProgress,
	MEDIA_TYPE_IMAGE,
	BlockControls,
	InspectorControls,
	BlockAlignmentToolbar,
	BlockStyles,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { __, _x, sprintf } from '@wordpress/i18n';
import { getProtocol, hasQueryArg } from '@wordpress/url';
import { doAction, hasAction } from '@wordpress/hooks';
import { compose, withPreferredColorScheme } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import {
	image as placeholderIcon,
	replace,
	fullscreen,
	textColor,
} from '@wordpress/icons';
import { store as coreStore } from '@wordpress/core-data';
import { store as editPostStore } from '@wordpress/edit-post';

/**
 * Internal dependencies
 */
import styles from './styles.scss';
import { getUpdatedLinkTargetSettings } from './utils';
import { KadencePanelBody } from '@kadence/components';

import {
	LINK_DESTINATION_CUSTOM,
	LINK_DESTINATION_ATTACHMENT,
	LINK_DESTINATION_MEDIA,
	MEDIA_ID_NO_FEATURED_IMAGE_SET,
} from './constants';

const getUrlForSlug = ( image, sizeSlug ) => {
	if ( ! sizeSlug ) {
		return undefined;
	}
	return image?.media_details?.sizes?.[ sizeSlug ]?.source_url;
};

export class ImageEdit extends Component {
	constructor( props ) {
		super( props );

		this.state = {
			isCaptionSelected: false,
		};

		this.finishMediaUploadWithSuccess = this.finishMediaUploadWithSuccess.bind(
			this
		);
		this.finishMediaUploadWithFailure = this.finishMediaUploadWithFailure.bind(
			this
		);
		this.mediaUploadStateReset = this.mediaUploadStateReset.bind( this );
		this.onSelectMediaUploadOption = this.onSelectMediaUploadOption.bind(
			this
		);
		this.updateMediaProgress = this.updateMediaProgress.bind( this );
		this.updateImageURL = this.updateImageURL.bind( this );
		this.onSetLinkDestination = this.onSetLinkDestination.bind( this );
		this.onSetNewTab = this.onSetNewTab.bind( this );
		this.onSetSizeSlug = this.onSetSizeSlug.bind( this );
		this.onImagePressed = this.onImagePressed.bind( this );
		this.onSetFeatured = this.onSetFeatured.bind( this );
		this.onFocusCaption = this.onFocusCaption.bind( this );
		this.updateAlignment = this.updateAlignment.bind( this );
		this.accessibilityLabelCreator = this.accessibilityLabelCreator.bind(
			this
		);
		this.setMappedAttributes = this.setMappedAttributes.bind( this );
		this.onSizeChangeValue = this.onSizeChangeValue.bind( this );

		this.linkSettingsOptions = {
			url: {
				label: __( 'Image Link URL' ),
				placeholder: __( 'Add URL' ),
				autoFocus: false,
				autoFill: true,
			},
			openInNewTab: {
				label: __( 'Open in new tab' ),
			},
			linkRel: {
				label: __( 'Link Rel' ),
				placeholder: _x(
					'None',
					'Link rel attribute value placeholder'
				),
			},
		};
	}

	componentDidMount() {
		const { attributes, setAttributes } = this.props;
		// This will warn when we have `id` defined, while `url` is undefined.
		// This may help track this issue: https://github.com/wordpress-mobile/WordPress-Android/issues/9768
		// where a cancelled image upload was resulting in a subsequent crash.
		if ( attributes.id && ! attributes.url ) {
			// eslint-disable-next-line no-console
			console.warn( 'Attributes has id with no url.' );
		}

		// Detect any pasted image and start an upload
		if (
			! attributes.id &&
			attributes.url &&
			getProtocol( attributes.url ) === 'file:'
		) {
			requestMediaImport( attributes.url, ( id, url ) => {
				if ( url ) {
					setAttributes( { id, url } );
				}
			} );
		}

		// Make sure we mark any temporary images as failed if they failed while
		// the editor wasn't open
		if (
			attributes.id &&
			attributes.url &&
			getProtocol( attributes.url ) === 'file:'
		) {
			mediaUploadSync();
		}
	}

	componentWillUnmount() {
		// this action will only exist if the user pressed the trash button on the block holder
		if (
			hasAction( 'blocks.onRemoveBlockCheckUpload' ) &&
			this.state.isUploadInProgress
		) {
			doAction(
				'blocks.onRemoveBlockCheckUpload',
				this.props.attributes.id
			);
		}
	}

	componentDidUpdate( previousProps ) {
		const { image, attributes, setAttributes } = this.props;
		if ( ! previousProps.image && image ) {
			const url =
				getUrlForSlug( image, attributes?.sizeSlug ) ||
				image.source_url;
			setAttributes( { url } );
		}
	}

	static getDerivedStateFromProps( props, state ) {
		// Avoid a UI flicker in the toolbar by insuring that isCaptionSelected
		// is updated immediately any time the isSelected prop becomes false
		return {
			isCaptionSelected: props.isSelected && state.isCaptionSelected,
		};
	}

	accessibilityLabelCreator( caption ) {
		// Checks if caption is empty.
		return ( typeof caption === 'string' && caption.trim().length === 0 ) ||
			caption === undefined ||
			caption === null
			? /* translators: accessibility text. Empty image caption. */
			  'Image caption. Empty'
			: sprintf(
					/* translators: accessibility text. %s: image caption. */
					__( 'Image caption. %s' ),
					caption
			  );
	}

	onImagePressed() {
		const { attributes, image } = this.props;

		if ( this.state.isUploadInProgress ) {
			requestImageUploadCancelDialog( attributes.id );
		} else if (
			attributes.id &&
			getProtocol( attributes.url ) === 'file:'
		) {
			requestImageFailedRetryDialog( attributes.id );
		} else if ( ! this.state.isCaptionSelected ) {
			requestImageFullscreenPreview(
				attributes.url,
				image && image.source_url
			);
		}

		this.setState( {
			isCaptionSelected: false,
		} );
	}

	updateMediaProgress( payload ) {
		const { setAttributes } = this.props;
		if ( payload.mediaUrl ) {
			setAttributes( { url: payload.mediaUrl } );
		}

		if ( ! this.state.isUploadInProgress ) {
			this.setState( { isUploadInProgress: true } );
		}
	}

	finishMediaUploadWithSuccess( payload ) {
		const { setAttributes } = this.props;

		setAttributes( { url: payload.mediaUrl, id: payload.mediaServerId } );
		this.setState( { isUploadInProgress: false } );
	}

	finishMediaUploadWithFailure( payload ) {
		const { setAttributes } = this.props;

		setAttributes( { id: payload.mediaId } );
		this.setState( { isUploadInProgress: false } );
	}

	mediaUploadStateReset() {
		const { setAttributes } = this.props;

		setAttributes( { id: null, url: null } );
		this.setState( { isUploadInProgress: false } );
	}

	updateImageURL( url ) {
		this.props.setAttributes( {
			url,
			width: undefined,
			height: undefined,
		} );
	}

	updateAlignment( nextAlign ) {
		const extraUpdatedAttributes = Object.values(
			WIDE_ALIGNMENTS.alignments
		).includes( nextAlign )
			? { width: undefined, height: undefined }
			: {};
		this.props.setAttributes( {
			...extraUpdatedAttributes,
			align: nextAlign,
		} );
	}

	onSetLinkDestination( href ) {
		this.props.setAttributes( {
			linkDestination: LINK_DESTINATION_CUSTOM,
			href,
		} );
	}

	onSetNewTab( value ) {
		const updatedLinkTarget = getUpdatedLinkTargetSettings(
			value,
			this.props.attributes
		);
		this.props.setAttributes( updatedLinkTarget );
	}

	onSetSizeSlug( sizeSlug ) {
		const { image, setAttributes } = this.props;

		const url = getUrlForSlug( image, sizeSlug );
		if ( ! url ) {
			return null;
		}
		setAttributes( {
			url,
			width: undefined,
			height: undefined,
			sizeSlug,
		} );
	}

	onSelectMediaUploadOption( media ) {
		const { imageDefaultSize } = this.props;
		const { id, url, destination } = this.props.attributes;
		const mediaAttributes = {
			id: media.id,
			url: media.url,
			caption: media.caption,
		};

		let additionalAttributes;
		// Reset the dimension attributes if changing to a different image.
		if ( ! media.id || media.id !== id ) {
			additionalAttributes = {
				width: undefined,
				height: undefined,
				sizeSlug: imageDefaultSize,
			};
		} else {
			// Keep the same url when selecting the same file, so "Image Size" option is not changed.
			additionalAttributes = { url };
		}

		let href;
		switch ( destination ) {
			case LINK_DESTINATION_MEDIA:
				href = media.url;
				break;
			case LINK_DESTINATION_ATTACHMENT:
				href = media.link;
				break;
		}
		mediaAttributes.href = href;

		this.props.setAttributes( {
			...mediaAttributes,
			...additionalAttributes,
		} );
	}

	onFocusCaption() {
		if ( this.props.onFocus ) {
			this.props.onFocus();
		}
		if ( ! this.state.isCaptionSelected ) {
			this.setState( {
				isCaptionSelected: true,
			} );
		}
	}

	getPlaceholderIcon() {
		return (
			<Icon
				icon={ placeholderIcon }
				{ ...this.props.getStylesFromColorScheme(
					styles.iconPlaceholder,
					styles.iconPlaceholderDark
				) }
			/>
		);
	}

	getWidth() {
		const { attributes } = this.props;
		const { align, width } = attributes;

		return Object.values( WIDE_ALIGNMENTS.alignments ).includes( align )
			? '100%'
			: width;
	}

	setMappedAttributes( { url: href, ...restAttributes } ) {
		const { setAttributes } = this.props;

		return href === undefined
			? setAttributes( {
					...restAttributes,
					linkDestination: LINK_DESTINATION_CUSTOM,
			  } )
			: setAttributes( {
					...restAttributes,
					href,
					linkDestination: LINK_DESTINATION_CUSTOM,
			  } );
	}

	getLinkSettings() {
		const { isLinkSheetVisible } = this.state;
		const {
			attributes: { href: url, ...unMappedAttributes },
		} = this.props;
		const mappedAttributes = { ...unMappedAttributes, url };

		return (
			<LinkSettingsNavigation
				isVisible={ isLinkSheetVisible }
				url={ mappedAttributes.url }
				rel={ mappedAttributes.rel }
				label={ mappedAttributes.label }
				linkTarget={ mappedAttributes.linkTarget }
				onClose={ this.dismissSheet }
				setAttributes={ this.setMappedAttributes }
				withBottomSheet={ false }
				hasPicker
				options={ this.linkSettingsOptions }
				showIcon={ false }
			/>
		);
	}

	getAltTextSettings() {
		const {
			attributes: { alt },
		} = this.props;

		const updateAlt = ( newAlt ) => {
			this.props.setAttributes( { alt: newAlt } );
		};

		return (
			<BottomSheetTextControl
				initialValue={ alt }
				onChange={ updateAlt }
				placeholder={ __( 'Add alt text' ) }
				label={ __( 'Alt Text' ) }
				icon={ textColor }
				footerNote={
					<>
						{ __(
							'Describe the purpose of the image. Leave empty if the image is purely decorative. '
						) }
						<FooterMessageLink
							href={
								'https://www.w3.org/WAI/tutorials/images/decision-tree/'
							}
							value={ __( 'What is alt text?' ) }
						/>
					</>
				}
			/>
		);
	}

	onSizeChangeValue( newValue ) {
		this.onSetSizeSlug( newValue );
	}

	onSetFeatured( mediaId ) {
		const { closeSettingsBottomSheet } = this.props;
		setFeaturedImage( mediaId );
		closeSettingsBottomSheet();
	}

	getFeaturedButtonPanel( isFeaturedImage ) {
		const { attributes, getStylesFromColorScheme } = this.props;

		const setFeaturedButtonStyle = getStylesFromColorScheme(
			styles.setFeaturedButton,
			styles.setFeaturedButtonDark
		);

		const removeFeaturedButton = () => (
			<BottomSheet.Cell
				label={ __( 'Remove as Featured Image ' ) }
				labelStyle={ [
					setFeaturedButtonStyle,
					styles.removeFeaturedButton,
				] }
				cellContainerStyle={ styles.setFeaturedButtonCellContainer }
				separatorType={ 'none' }
				onPress={ () =>
					this.onSetFeatured( MEDIA_ID_NO_FEATURED_IMAGE_SET )
				}
			/>
		);

		const setFeaturedButton = () => (
			<BottomSheet.Cell
				label={ __( 'Set as Featured Image ' ) }
				labelStyle={ setFeaturedButtonStyle }
				cellContainerStyle={ styles.setFeaturedButtonCellContainer }
				separatorType={ 'none' }
				onPress={ () => this.onSetFeatured( attributes.id ) }
			/>
		);

		return isFeaturedImage ? removeFeaturedButton() : setFeaturedButton();
	}

	render() {
		const { isCaptionSelected } = this.state;
		const {
			attributes,
			isSelected,
			image,
			clientId,
			imageDefaultSize,
			context: { imageCrop = false } = {},
			featuredImageId,
			wasBlockJustInserted,
		} = this.props;
		const { align, url, alt, id, sizeSlug, className } = attributes;

		const imageSizes = Array.isArray( this.props.imageSizes )
			? this.props.imageSizes
			: [];
		// Only map available image sizes for the user to choose.
		const sizeOptions = imageSizes
			.filter( ( { slug } ) => getUrlForSlug( image, slug ) )
			.map( ( { name, slug } ) => ( { value: slug, label: name } ) );

		let selectedSizeOption = sizeSlug || imageDefaultSize;
		let sizeOptionsValid = sizeOptions.find(
			( option ) => option.value === selectedSizeOption
		);

		if ( ! sizeOptionsValid ) {
			// Default to 'full' size if the default large size is not available.
			sizeOptionsValid = sizeOptions.find(
				( option ) => option.value === 'full'
			);
			selectedSizeOption = 'full';
		}

		// By default, it's only possible to set images that have been uploaded to a site's library as featured.
		// The 'canImageBeFeatured' check filters out images that haven't been uploaded based on the following:
		// - Images that are embedded in a post but are uploaded elsewhere have an id of 'undefined'.
		// - Image that are uploading or have failed to upload are given a temporary negative ID.
		const canImageBeFeatured =
			typeof attributes.id !== 'undefined' && attributes.id > 0;

		const isFeaturedImage =
			canImageBeFeatured && featuredImageId === attributes.id;

		const getToolbarEditButton = ( open ) => (
			<BlockControls>
				<ToolbarGroup>
					<ToolbarButton
						title={ __( 'Edit image' ) }
						icon={ replace }
						onClick={ open }
					/>
				</ToolbarGroup>
				<BlockAlignmentToolbar
					value={ align }
					onChange={ this.updateAlignment }
				/>
			</BlockControls>
		);

		const getInspectorControls = () => (
			<InspectorControls>
				<KadencePanelBody title={ __( 'Image settings' ) } panelName={ 'kb-image-image-settings' } />
				<KadencePanelBody
					style={ styles.panelBody }
					panelName={ 'kb-image-settings-style' }
				>
					<BlockStyles clientId={ clientId } url={ url } />
				</KadencePanelBody>
				<KadencePanelBody panelName={ 'kb-image-size' }>
					{ image && sizeOptionsValid && (
						<BottomSheetSelectControl
							icon={ fullscreen }
							label={ __( 'Size' ) }
							options={ sizeOptions }
							onChange={ this.onSizeChangeValue }
							value={ selectedSizeOption }
						/>
					) }
					{ this.getAltTextSettings() }
				</KadencePanelBody>
				<KadencePanelBody
					title={ __( 'Link Settings' ) }
					panelName={ 'kb-image-link-settings' }
				>
					{ this.getLinkSettings( true ) }
				</KadencePanelBody>
				<KadencePanelBody
					title={ __( 'Featured Image' ) }
					titleStyle={ styles.featuredImagePanelTitle }
					panelName={ 'kb-image-featured-image' }
				>
					{ canImageBeFeatured &&
						this.getFeaturedButtonPanel( isFeaturedImage ) }
					<FooterMessageControl
						label={ __(
							'Changes to featured image will not be affected by the undo/redo buttons.'
						) }
						cellContainerStyle={
							styles.setFeaturedButtonCellContainer
						}
					/>
				</KadencePanelBody>
			</InspectorControls>
		);

		if ( ! url ) {
			return (
				<View style={ styles.content }>
					<MediaPlaceholder
						allowedTypes={ [ MEDIA_TYPE_IMAGE ] }
						onSelect={ this.onSelectMediaUploadOption }
						icon={ this.getPlaceholderIcon() }
						onFocus={ this.props.onFocus }
						autoOpenMediaUpload={
							isSelected && wasBlockJustInserted
						}
					/>
				</View>
			);
		}

		const alignToFlex = {
			left: 'flex-start',
			center: 'center',
			right: 'flex-end',
			full: 'center',
			wide: 'center',
		};

		const additionalImageProps = {
			height: '100%',
			resizeMode: imageCrop ? 'cover' : 'contain',
		};

		const getImageComponent = ( openMediaOptions, getMediaOptions ) => (
			<Badge label={ __( 'Featured' ) } show={ isFeaturedImage }>
				<TouchableWithoutFeedback
					accessible={ ! isSelected }
					onPress={ this.onImagePressed }
					onLongPress={ openMediaOptions }
					disabled={ ! isSelected }
				>
					<View style={ styles.content }>
						{ isSelected && getInspectorControls() }
						{ isSelected && getMediaOptions() }
						{ ! this.state.isCaptionSelected &&
							getToolbarEditButton( openMediaOptions ) }
						<MediaUploadProgress
							coverUrl={ url }
							mediaId={ id }
							onUpdateMediaProgress={ this.updateMediaProgress }
							onFinishMediaUploadWithSuccess={
								this.finishMediaUploadWithSuccess
							}
							onFinishMediaUploadWithFailure={
								this.finishMediaUploadWithFailure
							}
							onMediaUploadStateReset={
								this.mediaUploadStateReset
							}
							renderContent={ ( {
								isUploadInProgress,
								isUploadFailed,
								retryMessage,
							} ) => {
								return (
									<View style={ styles.isGallery }>
										<Image
											align={
												align && alignToFlex[ align ]
											}
											alt={ alt }
											isSelected={
												isSelected &&
												! isCaptionSelected
											}
											isUploadFailed={ isUploadFailed }
											isUploadInProgress={
												isUploadInProgress
											}
											onSelectMediaUploadOption={
												this.onSelectMediaUploadOption
											}
											openMediaOptions={
												openMediaOptions
											}
											retryMessage={ retryMessage }
											url={ url }
											shapeStyle={ styles[ className ] }
											width={ this.getWidth() }
											{ ...additionalImageProps }
										/>
									</View>
								);
							} }
						/>
					</View>
				</TouchableWithoutFeedback>
				<BlockCaption
					clientId={ this.props.clientId }
					isSelected={ this.state.isCaptionSelected }
					accessible
					accessibilityLabelCreator={ this.accessibilityLabelCreator }
					onFocus={ this.onFocusCaption }
					onBlur={ this.props.onBlur } // always assign onBlur as props
					insertBlocksAfter={ this.props.insertBlocksAfter }
				/>
			</Badge>
		);

		return (
			<MediaUpload
				allowedTypes={ [ MEDIA_TYPE_IMAGE ] }
				isReplacingMedia={ true }
				onSelect={ this.onSelectMediaUploadOption }
				render={ ( { open, getMediaOptions } ) => {
					return getImageComponent( open, getMediaOptions );
				} }
			/>
		);
	}
}

export default compose( [
	withSelect( ( select, props ) => {
		const { getMedia } = select( coreStore );
		const { getSettings, wasBlockJustInserted } = select(
			blockEditorStore
		);
		const { getEditedPostAttribute } = select( 'core/editor' );
		const {
			attributes: { id, url },
			isSelected,
			clientId,
		} = props;
		const { imageSizes, imageDefaultSize } = getSettings();
		const isNotFileUrl = id && getProtocol( url ) !== 'file:';
		const featuredImageId = getEditedPostAttribute( 'featured_media' );

		const shouldGetMedia =
			( isSelected && isNotFileUrl ) ||
			// Edge case to update the image after uploading if the block gets unselected
			// Check if it's the original image and not the resized one with queryparams
			( ! isSelected &&
				isNotFileUrl &&
				url &&
				! hasQueryArg( url, 'w' ) );

		return {
			image: shouldGetMedia ? getMedia( id ) : null,
			imageSizes,
			imageDefaultSize,
			featuredImageId,
			wasBlockJustInserted: wasBlockJustInserted(
				clientId,
				'inserter_menu'
			),
		};
	} ),
	withDispatch( ( dispatch ) => {
		return {
			closeSettingsBottomSheet() {
				dispatch( editPostStore ).closeGeneralSidebar();
			},
		};
	} ),
	withPreferredColorScheme,
] )( ImageEdit );
