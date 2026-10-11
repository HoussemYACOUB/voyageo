package com.riskboard.backend.shared.logging;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class ServiceTimingAspect {

    private static final Logger logger = LoggerFactory.getLogger(ServiceTimingAspect.class);

    @Around("execution(public * com.riskboard.backend..service..*(..))")
    public Object logServiceDuration(ProceedingJoinPoint invocation) throws Throwable {
        long startedAt = System.nanoTime();
        try {
            return invocation.proceed();
        } finally {
            long elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000;
            logger.info("service={} durationMs={}", invocation.getSignature().toShortString(), elapsedMillis);
        }
    }
}
