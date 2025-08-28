# File Upload System

This project includes a comprehensive file upload system with both REST API and GraphQL endpoints.

## Features

- **File Upload Middleware**: Handles file uploads with multer
- **Static File Serving**: Serves uploaded files from `/uploads` endpoint
- **Integrated Profile Updates**: File uploads handled directly in editProfile mutation
- **File Validation**: Validates file types and sizes
- **Custom Naming**: Files are named using username and timestamp

## Directory Structure

```
public/
  uploads/
    profiles/     # Profile pictures
    default/      # Default upload folder
    [custom]/     # Custom folders as specified
```

## REST API Endpoint

### Upload File

**POST** `/upload`

**Form Data:**

- `file`: The file to upload (required)
- `username`: Username for file naming (optional, defaults to 'user')
- `folderName`: Folder name (optional, defaults to 'default')

**Response:**

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "statusCode": 200,
  "data": {
    "filename": "john_1234567890.jpg",
    "originalName": "profile.jpg",
    "path": "/uploads/profiles/john_1234567890.jpg",
    "size": 1024000,
    "mimetype": "image/jpeg"
  }
}
```

## GraphQL Mutations

### Edit Profile with File Upload

```graphql
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
```

**Variables:**

- `username`, `fullName`, `dob`, `gender`, `bio`: Text fields for profile data
- `profilePicture`: Direct URL path (optional)
- `profilePictureFile`: Base64 encoded image file (e.g., "data:image/jpeg;base64,/9j/4AAQ...")

**Note:** You can use either `profilePicture` (for existing URLs) or `profilePictureFile` (for new uploads). If both are provided, the uploaded file takes precedence.

## File Access

Uploaded files are accessible via:

- **Local**: `http://localhost:9095/uploads/[folder]/[filename]`
- **Production**: `https://yourdomain.com/uploads/[folder]/[filename]`

## File Validation

- **File Types**: Only image files (image/\*)
- **File Size**: Maximum 5MB
- **Naming**: `{username}_{timestamp}.{extension}`

## Error Handling

The system handles various upload errors:

- File too large
- Invalid file type
- Missing files
- Server errors

## Usage Examples

### Using REST API with curl

```bash
curl -X POST http://localhost:9095/upload \
  -F "file=@profile.jpg" \
  -F "username=john" \
  -F "folderName=profiles"
```

### Using GraphQL with base64

```javascript
// Convert file to base64
const file = fs.readFileSync('profile.jpg');
const base64 = file.toString('base64');
const dataUrl = `data:image/jpeg;base64,${base64}`;

// Use in editProfile mutation
const result = await editProfile({
  username: 'john',
  fullName: 'John Doe',
  bio: 'Hello there',
  profilePictureFile: dataUrl,
});
```

## Security Considerations

- Files are validated for type and size
- Only authenticated users can upload files
- Files are stored in a controlled directory structure
- Original filenames are not preserved for security
