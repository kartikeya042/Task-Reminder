const testimonials = [
  {
    name: 'Priya Sharma',
    role: 'Computer Science Student',
    quote:
      'Yadhwala turned my chaotic assignment list into something I actually follow. The WhatsApp reminders are a game changer.',
  },
  {
    name: 'Rahul Menon',
    role: 'Freelance Developer',
    quote:
      'Clean interface, no fluff. I open the dashboard, see what is upcoming, and get nudged before I forget client deadlines.',
  },
  {
    name: 'Ananya Reddy',
    role: 'MBA Candidate',
    quote:
      'The signup was quick and the email verification gave me confidence. It feels like a product built with care.',
  },
  {
    name: 'Vikram Das',
    role: 'Startup Founder',
    quote:
      'We use Yadhwala for personal task tracking across the team. Simple, effective, and dependable.',
  },
];

export default function Testimonials() {
  return (
    <div className="public-page">
      <div className="public-container">
        <div className="public-page-header">
          <span className="public-eyebrow">Testimonials</span>
          <h1>Loved by people who hate missing deadlines</h1>
          <p className="public-lead public-lead-centered">
            Hear from users who rely on Yadhwala to stay organized and on time.
          </p>
        </div>

        <div className="public-testimonial-grid">
          {testimonials.map((item) => (
            <article key={item.name} className="public-testimonial-card">
              <p className="public-testimonial-quote">&ldquo;{item.quote}&rdquo;</p>
              <div className="public-testimonial-author">
                <div className="public-avatar" aria-hidden="true">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.role}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
