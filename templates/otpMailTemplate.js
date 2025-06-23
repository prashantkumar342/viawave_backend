export const otpMailTemplate = (otp) => {
  return `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); outline:solid 1px">
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="https://res.cloudinary.com/tuhaniaji342cloud/image/upload/v1746008490/ymumydf2801sfoifpgfq.png" alt="ViaWave Logo" style="width: 90px; height: 90px;" />
        <h1 style="color: #2d3748; font-size: 24px; font-weight: 600; margin: 15px 0 0;">ViaWave</h1>
        <p style="color: #718096; font-size: 16px; margin: 5px 0 0;">Signal Your Presence</p>
      </div>
      
      <div style="background-color: #f7fafc; border-radius: 8px; padding: 25px; margin: 20px 0;">
        <p style="font-size: 16px; color: #4a5568; margin: 0 0 15px;">Hello,</p>
        <p style="font-size: 16px; color: #4a5568; margin: 0 0 20px;">
          Your one-time password (OTP) to proceed with your action on <strong>ViaWave</strong> is:
        </p>
        
        <div style="background-color: #ebf4ff; border-left: 4px solid #4299e1; padding: 15px; border-radius: 4px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #2b6cb0; letter-spacing: 5px;">${otp}</span>
        </div>
        
        <p style="font-size: 14px; color: #718096; margin: 20px 0 0;">
          This OTP is valid for <strong>10 minutes</strong>. Please do not share it with anyone.
        </p>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 14px; color: #718096; margin: 0;">
          If you didn't request this OTP, please ignore this email or contact support.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 25px;">
        <p style="font-size: 14px; color: #a0aec0; margin: 0;">Thanks,</p>
        <p style="font-size: 15px; font-weight: 600; color: #4a5568; margin: 5px 0 0;">The ViaWave Team</p>
      </div>
      
      <div style="text-align: center; margin-top: 25px;">
        <a href="#" style="display: inline-block; margin: 0 8px; color: #4299e1; text-decoration: none;">
          <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" style="width: 24px; height: 24px;">
        </a>
        <a href="#" style="display: inline-block; margin: 0 8px; color: #4299e1; text-decoration: none;">
          <img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" alt="Twitter" style="width: 24px; height: 24px;">
        </a>
        <a href="#" style="display: inline-block; margin: 0 8px; color: #4299e1; text-decoration: none;">
          <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Instagram" style="width: 24px; height: 24px;">
        </a>
      </div>
    </div>
  `;
};