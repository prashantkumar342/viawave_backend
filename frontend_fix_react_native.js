// Fixed frontend handler for React Native with proper image handling
import RNFS from 'react-native-fs';

import { gql } from 'graphql-request';

export const EDIT_PROFILE = gql`
  mutation EditProfile(
    $username: String
    $fullName: String
    $dob: String
    $gender: String
    $bio: String
    $profilePicture: String
    $profilePictureFile: String
  ) {
    editProfile(
      username: $username
      fullName: $fullName
      dob: $dob
      gender: $gender
      bio: $bio
      profilePicture: $profilePicture
      profilePictureFile: $profilePictureFile
    ) {
      success
      message
      statusCode
      user {
        id
        username
        email
        firstname
        lastname
        bio
        profilePicture
        isVerified
        sentLinks
        receivedLinks
        links
        role
        provider
        googleId
        createdAt
        updatedAt
        fullName
        dob
        gender
        is_linked
        contactNumber
        coverImage
        email_verified
        totalLinks
        lastLogin
      }
    }
  }
`;

// Helper function to convert image URI to base64 for React Native
const convertImageToBase64 = async (uri) => {
  try {
    // For React Native, we need to handle different URI schemes
    let filePath = uri;

    // Handle file:// URIs
    if (uri.startsWith('file://')) {
      filePath = uri.replace('file://', '');
    }

    // Handle content:// URIs (Android)
    if (uri.startsWith('content://')) {
      // For content URIs, we might need to copy to a temporary file first
      const tempPath = `${RNFS.TemporaryDirectoryPath}/temp_image_${Date.now()}.jpg`;
      await RNFS.copyFile(uri, tempPath);
      filePath = tempPath;
    }

    // Read file as base64
    const base64 = await RNFS.readFile(filePath, 'base64');

    // Determine MIME type from file extension
    const extension = filePath.split('.').pop().toLowerCase();
    let mimeType = 'image/jpeg'; // default

    switch (extension) {
      case 'png':
        mimeType = 'image/png';
        break;
      case 'gif':
        mimeType = 'image/gif';
        break;
      case 'webp':
        mimeType = 'image/webp';
        break;
      default:
        mimeType = 'image/jpeg';
    }

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
};

// Fixed handler function for React Native
export const handleEditProfile = async (data, token) => {
  try {
    console.log(data, 'edit profile payload');

    // Prepare variables
    const variables = {
      username: data.username?.trim(),
      fullName: data.fullName?.trim(),
      dob: data.dob?.trim(),
      bio: data.bio?.trim(),
      gender: data.gender?.trim(),
    };

    // Handle profile picture
    if (data.profilePicture) {
      // Check if it's already a base64 string or a URL
      if (data.profilePicture.startsWith('data:image/')) {
        // Already base64 encoded
        variables.profilePictureFile = data.profilePicture;
      } else if (
        data.profilePicture.startsWith('http') ||
        data.profilePicture.startsWith('/uploads/')
      ) {
        // It's a URL, use profilePicture field
        variables.profilePicture = data.profilePicture;
      } else {
        // It's a local file URI, convert to base64
        try {
          const base64Image = await convertImageToBase64(data.profilePicture);
          variables.profilePictureFile = base64Image;
        } catch (error) {
          console.error('Failed to convert image to base64:', error);
          // Fallback to using the URI as is
          variables.profilePicture = data.profilePicture;
        }
      }
    }

    const client = getGraphQLClient(token);
    const response = await client.request(EDIT_PROFILE, variables);
    return response.editProfile;
  } catch (error) {
    console.error('editProfile error:', error);
    throw new Error('editProfile failed. Please try again.');
  }
};
