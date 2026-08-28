#include <iostream>
#include <optional>

struct RetryPolicy {
    int attempts;
    int delay_ms;
};

int effective_attempts(const std::optional<RetryPolicy>& override_policy) {
    return override_policy ? override_policy->attempts : 3;
}

int main() {
    std::optional<RetryPolicy> policy;
    std::cout << effective_attempts(policy) << '\n';

    RetryPolicy& installed = policy.emplace(RetryPolicy{5, 200});
    std::cout << installed.attempts << ':' << policy->delay_ms << '\n';

    policy.reset(); // installed must not be used after this point.
    std::cout << std::boolalpha << policy.has_value() << '\n';
}
