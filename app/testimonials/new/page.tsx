import { TestimonialForm } from '@/components/testimonials/testimonial-form';

export default function NewTestimonialPage() {
    return (
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">Novo Testemunho</h1>
            <TestimonialForm />
        </div>
    );
}
