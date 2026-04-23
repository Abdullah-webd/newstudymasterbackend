import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
    try {
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'StudyMaster <no-reply@myschoolmanager.org>';
        
        console.log(`Attempting to send email to: ${options.email} from: ${fromEmail}`);

        const data = await resend.emails.send({
            from: fromEmail,
            to: options.email,
            subject: options.subject,
            html: options.html || `<p>${options.message}</p>`,
        });

        if (data.error) {
            console.error('Resend API returned an error:', data.error);
            throw new Error(data.error.message || 'Failed to send email');
        }

        console.log(`Email sent successfully: ${data.data?.id || 'No ID'}`);
        return data;
    } catch (error) {
        console.error('Error sending email through Resend:', error.message);
        // Log more details if available
        if (error.response) {
            console.error('Resend error response:', error.response.data);
        }
        throw error;
    }
};

export default sendEmail;
