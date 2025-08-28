// Fixed frontend handler for editProfile with proper image handling
import { gql } from 'graphql-request';

// Helper function to convert image URI to base64
const convertImageToBase64 = async (uri) => {
  try {
    // For React Native, we need to use fetch to get the image as blob
    const response = await fetch(uri);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
};

// Fixed handler function
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
