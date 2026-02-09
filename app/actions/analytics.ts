'use server';

import { prisma } from '@/lib/prisma';

export async function getDashboardMetrics() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        // Total counts
        const [totalPosts, totalServices, totalProjects, totalComments, totalViews, totalLikes, totalDislikes] = await Promise.all([
            prisma.post.count(),
            prisma.service.count(),
            prisma.product.count(),
            prisma.comment.count({ where: { approved: true } }),
            prisma.postView.count(),
            prisma.postLike.count({ where: { isLike: true } }),
            prisma.postLike.count({ where: { isLike: false } }),
        ]);

        // Today's metrics
        const [todayViews, todayComments, todayLikes] = await Promise.all([
            prisma.postView.count({ where: { createdAt: { gte: today } } }),
            prisma.comment.count({ where: { createdAt: { gte: today } } }),
            prisma.postLike.count({ where: { createdAt: { gte: today }, isLike: true } }),
        ]);

        // Yesterday's metrics for comparison
        const [yesterdayViews, yesterdayComments, yesterdayLikes] = await Promise.all([
            prisma.postView.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
            prisma.comment.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
            prisma.postLike.count({ where: { createdAt: { gte: yesterday, lt: today }, isLike: true } }),
        ]);

        // Top posts by views
        const topPosts = await prisma.post.findMany({
            take: 5,
            include: {
                _count: {
                    select: {
                        views: true,
                        comments: true,
                        likes: true,
                    },
                },
            },
            orderBy: {
                views: {
                    _count: 'desc',
                },
            },
        });

        // Recent comments (pending approval)
        const pendingComments = await prisma.comment.count({
            where: { approved: false },
        });

        // Chart data for last 7 days
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const [views, comments, likes] = await Promise.all([
                prisma.postView.count({ where: { createdAt: { gte: date, lt: nextDate } } }),
                prisma.comment.count({ where: { createdAt: { gte: date, lt: nextDate } } }),
                prisma.postLike.count({ where: { createdAt: { gte: date, lt: nextDate }, isLike: true } }),
            ]);

            chartData.push({
                date: date.toISOString().split('T')[0],
                views,
                comments,
                likes,
            });
        }

        return {
            success: true,
            data: {
                totals: {
                    posts: totalPosts,
                    services: totalServices,
                    projects: totalProjects,
                    comments: totalComments,
                    views: totalViews,
                    likes: totalLikes,
                    dislikes: totalDislikes,
                },
                today: {
                    views: todayViews,
                    comments: todayComments,
                    likes: todayLikes,
                },
                yesterday: {
                    views: yesterdayViews,
                    comments: yesterdayComments,
                    likes: yesterdayLikes,
                },
                topPosts,
                pendingComments,
                chartData,
            },
        };
    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        return { success: false, error: 'Failed to fetch metrics' };
    }
}
