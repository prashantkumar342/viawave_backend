// Test file for editProfile with file upload functionality
// This demonstrates how to use the new integrated approach

const testEditProfileWithFile = async () => {
  // Example GraphQL mutation
  const mutation = `
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
          fullName
          profilePicture
          bio
          gender
          dob
        }
      }
    }
  `;

  // Example 1: Update text fields only
  const textOnlyUpdate = {
    username: 'john_doe',
    fullName: 'John Doe',
    bio: 'Hello, this is my bio!',
    gender: 'male',
  };

  // Example 2: Update with file upload
  const fileUpdate = {
    username: 'john_doe',
    fullName: 'John Doe',
    bio: 'Updated bio with new picture',
    profilePictureFile: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...', // Base64 encoded image
  };

  // Example 3: Update with existing URL
  const urlUpdate = {
    username: 'john_doe',
    profilePicture: '/uploads/profiles/john_doe_1234567890.jpg',
  };

  console.log('✅ editProfile now supports:');
  console.log('  - Text field updates (username, fullName, dob, gender, bio)');
  console.log('  - File uploads via profilePictureFile (base64)');
  console.log('  - Direct URL assignment via profilePicture');
  console.log('  - All in a single mutation!');

  return {
    mutation,
    examples: {
      textOnly: textOnlyUpdate,
      withFile: fileUpdate,
      withUrl: urlUpdate,
    },
  };
};

// Export for testing
export { testEditProfileWithFile };

// Usage example:
// const result = await testEditProfileWithFile();
// console.log(result);
