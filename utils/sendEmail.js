import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
    try {
        const data = await resend.emails.send({
            from: 'StudyMaster <onboarding@resend.dev>', // Update with verified domain in production
            to: options.email,
            subject: options.subject,
            html: options.html || `<p>${options.message}</p>`,
        });

        console.log(`Email sent successfully: ${data.id}`);
        return data;
    } catch (error) {
        console.error('Error sending email through Resend:', error);
        throw error;
    }
};

export default sendEmail;
