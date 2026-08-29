#include <deque>
#include <iostream>

int main() {
    std::deque<int> recent;

    for (const int latency : {12, 15, 18, 21}) {
        recent.push_back(latency);
        if (recent.size() > 3) {
            recent.pop_front();
        }
    }

    for (std::deque<int>::size_type index{}; index < recent.size(); ++index) {
        std::cout << recent[index]
                  << (index + 1 == recent.size() ? '\n' : ' ');
    }
}
