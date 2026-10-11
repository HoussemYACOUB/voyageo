package com.riskboard.backend.travel.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import com.riskboard.backend.auth.model.UserAccount;
import com.riskboard.backend.travel.model.PriceAlert;

@Service
public class PriceAlertEmailService {

    private static final Logger logger = LoggerFactory.getLogger(PriceAlertEmailService.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final String smtpHost;
    private final String fromAddress;

    public PriceAlertEmailService(
            ObjectProvider<JavaMailSender> mailSender,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${notifications.email.from:}") String fromAddress
    ) {
        this.mailSender = mailSender;
        this.smtpHost = smtpHost;
        this.fromAddress = fromAddress;
    }

    public boolean isConfigured() {
        return !smtpHost.isBlank() && !fromAddress.isBlank() && mailSender.getIfAvailable() != null;
    }

    public void send(PriceAlert alert, UserAccount user) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null || !isConfigured()) return;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(user.getEmail());
        message.setSubject("Votre alerte de prix Voyageo");
        message.setText("Le vol " + alert.getOriginIata() + " → " + alert.getDestinationIata()
                + " est actuellement à " + alert.getObservedPrice() + " " + alert.getCurrency()
                + ", sous votre seuil de " + alert.getTargetPrice() + " " + alert.getCurrency() + ".");
        try {
            sender.send(message);
        } catch (MailException exception) {
            logger.error("Price alert email delivery failed for alertId={}", alert.getId(), exception);
        }
    }
}
