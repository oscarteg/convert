import type { Handle } from '@sveltejs/kit';
import { USERS } from '$env/static/private';
import type { User } from '$lib/types';

/**
 * ? The types you will need to copy are in $lib/types and src/app.d.ts
 */

const users: User[] = JSON.parse(USERS);

export const basicAuth: Handle = async ({ event, resolve }) => {
	const authorization = event.request.headers.get('Authorization');

	if (!authorization || !authorization.startsWith('Basic '))
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Protected"'
			}
		});

	const token = authorization.replace('Basic ', '');

	const [username, password] = Buffer.from(token, 'base64').toString().split(':');

	const user: User | undefined = users.find(
		(u) => u.username === username && u.password === password
	);

	if (!user)
		return new Response('Unauthorized', {
			status: 401,
			headers: {
				'WWW-Authenticate': 'Basic realm="Protected"'
			}
		});

	event.locals.user = {
		username: user.username
	};

	const response = await resolve(event);

	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

	return response;
};

// Use sequence if you have multiple hooks
// https://kit.svelte.dev/docs/modules#sveltejs-kit-hooks-sequence
export const handle = basicAuth;
