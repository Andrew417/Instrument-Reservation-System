import createServerApp from '../server';

export default async function handler(req: any, res: any) {
	const app = await createServerApp();
	return app(req, res);
}