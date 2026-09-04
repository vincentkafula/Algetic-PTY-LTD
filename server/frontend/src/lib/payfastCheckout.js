/**
 * Builds a hidden HTML form from PayFast's checkout fields and submits
 * it, redirecting the browser to PayFast's hosted checkout page. This is
 * PayFast's documented integration pattern — a real form POST, not an
 * API call — so the browser actually navigates there.
 */
export function redirectToPayfastCheckout(payfastUrl, checkoutFields) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payfastUrl;
  for (const [key, value] of Object.entries(checkoutFields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
